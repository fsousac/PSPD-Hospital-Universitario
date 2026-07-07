#!/usr/bin/env bash
# Provisiona o realm "hu" no Keycloak local (docker compose) para desenvolvimento:
# roles (medico/estagiario/pesquisador), client "authorization-service" e
# usuários de teste casados com o seed de db/migrations/001_authorization_schema.sql.
#
# Uso:
#   docker compose up -d postgres keycloak
#   ./scripts/setup-keycloak.sh
#
# Idempotente: pode ser rodado de novo sem duplicar realm/roles/client/usuários.

set -euo pipefail

KEYCLOAK_CONTAINER="${KEYCLOAK_CONTAINER:-hu-keycloak}"
KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8180}"
REALM="hu"
CLIENT_ID="authorization-service"
ADMIN_USER="${KEYCLOAK_ADMIN:-admin}"
ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
TEST_USER_PASSWORD="${TEST_USER_PASSWORD:-test1234}"

kcadm() {
  docker exec "$KEYCLOAK_CONTAINER" /opt/keycloak/bin/kcadm.sh "$@"
}

echo "Aguardando Keycloak ficar disponível em $KEYCLOAK_URL ..."
for _ in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$KEYCLOAK_URL/realms/master/.well-known/openid-configuration" || true)
  [ "$code" = "200" ] && break
  sleep 3
done
if [ "$code" != "200" ]; then
  echo "Keycloak não respondeu a tempo em $KEYCLOAK_URL. Rode 'docker compose up -d postgres keycloak' primeiro." >&2
  exit 1
fi

kcadm config credentials --server "$KEYCLOAK_URL" --realm master --user "$ADMIN_USER" --password "$ADMIN_PASSWORD"

if kcadm get "realms/$REALM" >/dev/null 2>&1; then
  echo "Realm '$REALM' já existe — pulando criação."
else
  echo "Criando realm '$REALM' ..."
  kcadm create realms -s realm="$REALM" -s enabled=true
fi

for role in medico estagiario pesquisador; do
  if kcadm get "roles/$role" -r "$REALM" >/dev/null 2>&1; then
    echo "Role '$role' já existe — pulando."
  else
    echo "Criando role '$role' ..."
    kcadm create roles -r "$REALM" -s name="$role"
  fi
done

existing_client=$(kcadm get clients -r "$REALM" -q clientId="$CLIENT_ID")
if [[ "$existing_client" == *'"clientId"'* ]]; then
  echo "Client '$CLIENT_ID' já existe — pulando."
else
  echo "Criando client '$CLIENT_ID' ..."
  kcadm create clients -r "$REALM" \
    -s clientId="$CLIENT_ID" -s publicClient=true -s directAccessGrantsEnabled=true -s enabled=true
fi

# username;role;firstName;lastName — username deve corresponder ao usado em
# user_patient_assignments/projects (ver db/migrations/001_authorization_schema.sql).
USERS=(
  "dr.silva;medico;Dr;Silva"               # vínculo ativo (P000001) e inativo (P000002)
  "dr.costa;medico;Dr;Costa"                # sem vínculo -> DENY
  "estagiario.ana;estagiario;Ana;Estagiaria"     # vínculo ativo (P000001)
  "estagiario.bruno;estagiario;Bruno;Estagiario" # sem vínculo -> DENY
  "pesquisador.souza;pesquisador;Souza;Pesquisador" # PRJ01 Aprovado / PRJ02 Suspenso
  "pesquisador.lima;pesquisador;Lima;Pesquisadora"  # PRJ03 Aprovado mas expirado (2024)
)

for entry in "${USERS[@]}"; do
  IFS=';' read -r username role first last <<< "$entry"
  existing_user=$(kcadm get users -r "$REALM" -q username="$username")
  if [[ "$existing_user" == *'"username"'* ]]; then
    echo "Usuário '$username' já existe — pulando."
    continue
  fi
  echo "Criando usuário '$username' (role: $role) ..."
  # email/firstName/lastName são obrigatórios: o User Profile declarativo do
  # Keycloak 25 rejeita login ("Account is not fully set up") sem eles.
  kcadm create users -r "$REALM" \
    -s username="$username" -s enabled=true -s emailVerified=true \
    -s email="$username@hu.example.org" -s firstName="$first" -s lastName="$last"
  kcadm set-password -r "$REALM" --username "$username" --new-password "$TEST_USER_PASSWORD"
  kcadm add-roles -r "$REALM" --uusername "$username" --rolename "$role"
done

echo
echo "Pronto. Usuários no realm '$REALM':"
kcadm get users -r "$REALM" --fields username,enabled | grep username
