# authorization-service

Stack: **Java 21 + Quarkus 3.37 + Gradle** (ver decisão de build tool na
seção abaixo) + Keycloak/OIDC + PostgreSQL.

## Responsabilidade

Recebe um JWT emitido pelo Keycloak (dentro do corpo da mensagem gRPC) mais
o recurso/ação solicitados, e decide `ALLOW`/`DENY` + nível de exposição de
dado (`FULL | PARTIAL | ANONYMIZED | AGGREGATED`), de acordo com o papel do
usuário:

| Papel        | Verificação                                                                 | Nível se ALLOW |
|--------------|------------------------------------------------------------------------------|-----------------|
| medico       | vínculo ativo em `user_patient_assignments` (tipo_vinculo=medico)           | FULL            |
| estagiario   | vínculo ativo em `user_patient_assignments` (tipo_vinculo=estagiario)       | PARTIAL         |
| pesquisador  | projeto em `projects` aprovado e vigente para a condição clínica da coorte  | ANONYMIZED (leitura) / AGGREGATED (estatística) |

A aplicação da anonimização/agregação nos dados em si é responsabilidade do
**Data Transform Service** — este serviço só informa qual nível se aplica.

## Como rodar localmente

Pré-requisitos: Docker (Keycloak + PostgreSQL), JDK 21.

```bash
# 1. Suba Keycloak + Postgres (a partir da raiz do repositório)
docker compose up -d postgres keycloak

# 2. Provisione o realm "hu" + usuários de teste (idempotente, pode rodar de novo)
./scripts/setup-keycloak.sh

# 3. Rode o serviço em modo dev (live reload)
cd services/authorization-service
./gradlew quarkusDev
```

O gRPC server sobe na mesma porta HTTP (`8080`), junto com `/q/health` e
`/q/metrics`.

## Testes

```bash
./gradlew test
```

- `AuthorizationDecisionServiceTest` — unitário, repositórios mockados
  (Mockito), sem subir Quarkus nem banco. Cobre as 3 regras de decisão
  (médico ALLOW/DENY, estagiário ALLOW/DENY, pesquisador ALLOW/DENY,
  incluindo projeto suspenso/expirado) e casos de borda (role desconhecida,
  tipo de recurso incompatível com o papel).
- `AuthorizationGrpcServiceIT` — integração ponta a ponta via `@QuarkusTest`:
  request gRPC real → validação de JWT → consulta ao PostgreSQL → resposta.
  O Postgres é provisionado automaticamente via **Quarkus Dev
  Services/Testcontainers** (não requer `docker compose up` — só requer
  Docker disponível na máquina). Dados de teste em
  `src/test/resources/import.sql`; tokens assinados em teste com o par de
  chaves de `src/test/resources/{privateKey,publicKey}.pem` — chaves
  descartáveis, só para assinar tokens dentro da suíte de testes, nunca
  usadas em `%dev`/`%prod` (detalhes em
  [`src/test/resources/KEYS-README.md`](src/test/resources/KEYS-README.md)).

Resultado local (14 testes, todos verdes):

```
BUILD SUCCESSFUL
9 tests — AuthorizationDecisionServiceTest — todos passaram
5 tests — AuthorizationGrpcServiceIT — todos passaram
```

## Variáveis de ambiente (perfil `%prod`, usado pelo Dockerfile/docker-compose)

| Variável                         | Default                                      | Descrição                          |
|-----------------------------------|-----------------------------------------------|-------------------------------------|
| `QUARKUS_DATASOURCE_JDBC_URL`     | `jdbc:postgresql://postgres:5432/hu_db`      | URL JDBC do PostgreSQL              |
| `QUARKUS_DATASOURCE_USERNAME`     | `hu_user`                                     | usuário do banco                    |
| `QUARKUS_DATASOURCE_PASSWORD`     | `hu_password`                                 | senha do banco                      |
| `QUARKUS_OIDC_AUTH_SERVER_URL`    | `http://keycloak:8180/realms/hu`             | realm Keycloak (issuer + JWKS)      |
| `QUARKUS_OIDC_CLIENT_ID`          | `authorization-service`                       | client id no Keycloak               |

## Setup do realm Keycloak local (desenvolvimento)

`../../scripts/setup-keycloak.sh` provisiona tudo: realm **`hu`**, *Realm
roles* `medico`/`estagiario`/`pesquisador`, client **`authorization-service`**
(`public`, *Direct access grants* habilitado — suficiente para login por
usuário/senha em teste) e 6 usuários de teste casados com o seed de
`db/migrations/001_authorization_schema.sql` (2 por papel: um com vínculo
ativo/projeto aprovado para testar `ALLOW`, outro sem para testar `DENY`).
Idempotente — pode rodar de novo sem duplicar nada.

```bash
docker compose up -d postgres keycloak
./scripts/setup-keycloak.sh
```

**Nota:** o Keycloak 25 exige `email`, `firstName` e `lastName` preenchidos
para o login funcionar (User Profile declarativo) — um usuário criado só com
`username`/senha falha no login com `{"error":"invalid_grant",
"error_description":"Account is not fully set up"}` mesmo com
`requiredActions` vazio. O script já preenche os três campos; se for criar
usuários manualmente pelo console admin, preencha-os também.

O serviço lê os papéis do claim padrão do Keycloak `realm_access.roles`, sem
necessidade de mapper adicional.

## Exemplo de request/response gRPC

O servidor não expõe *reflection* (`grpcurl` precisa do `.proto`). Obtenha um
token pela rede que o serviço enxerga — se estiver testando de fora do
Docker, use a URL pela qual o **container** do authorization-service alcança
o Keycloak (`http://keycloak:8180`, não `localhost:8180`), senão o claim
`iss` do token não bate com `QUARKUS_OIDC_AUTH_SERVER_URL` e a validação
falha com "JWT inválido":

```bash
TOKEN=$(docker exec hu-auth-service curl -s -X POST \
  http://keycloak:8180/realms/hu/protocol/openid-connect/token \
  -d client_id=authorization-service -d username=dr.silva -d password=test1234 \
  -d grant_type=password | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

grpcurl -plaintext -import-path ../../proto -proto authorization.proto \
  -d "{\"jwt_token\":\"$TOKEN\",\"resource_type\":\"PATIENT\",\"resource_id\":\"P000001\",\"action\":\"READ\"}" \
  localhost:8080 hu.authorization.v1.AuthorizationService/Authorize
```

Resposta real, validada contra a stack rodando (vínculo ativo em
`user_patient_assignments`):

```json
{
  "allowed": true,
  "accessLevel": "FULL",
  "reason": "vínculo 'medico' ativo encontrado",
  "subjectId": "dr.silva"
}
```

Para o perfil pesquisador, `resource_type=RESEARCH_PROJECT` e `resource_id`
carrega o **`project_id`** (ex.: `"PRJ01"`) — ver ADR 0001 para o racional
desse mapeamento sobre o proto genérico.

## Decisões técnicas

Ver [`docs/decisions/0001-authorization-service-technical-decisions.md`](../../docs/decisions/0001-authorization-service-technical-decisions.md).
Resumo rápido do que não estava explícito no enunciado:

- **Build tool: Gradle, não Maven.** O ambiente de desenvolvimento não tinha
  Maven instalado nem rede liberada para instalá-lo via `apt`; Gradle já
  estava disponível/baixável e o Quarkus tem suporte de primeira classe para
  os dois. Nenhuma regra de negócio depende disso.
- Token validado via `quarkus-smallrye-jwt` (`JWTParser`), não pela
  validação automática de `quarkus-oidc` — o JWT chega dentro do corpo da
  mensagem gRPC (`jwt_token`), não no header "authorization" da chamada.
- Papel extraído de `realm_access.roles`; prioridade médico > estagiário >
  pesquisador quando o token carrega mais de um.
- `db/migrations/` criado do zero (não existia no repositório) com apenas as
  2 tabelas que este serviço lê.
