// Resource Owner Password Credentials (grant_type=password) contra o client
// público "admin-cli" — workaround enquanto o client OIDC "hu-frontend"
// (Authorization Code + PKCE) não existe no realm real do cluster
// ("Client not found" no /auth do Keycloak — bloqueio externo, requer o
// professor/monitor criar o client). admin-cli é o mesmo client já
// confirmado funcional por loadtests/k6-scenario.js.
const SCOPE = 'openid microprofile-jwt';

function tokenEndpoint(keycloakUrl, realm) {
  return `${keycloakUrl}/realms/${realm}/protocol/openid-connect/token`;
}

async function requestToken(keycloakUrl, realm, clientId, params) {
  const body = new URLSearchParams({ client_id: clientId, scope: SCOPE, ...params });
  const response = await fetch(tokenEndpoint(keycloakUrl, realm), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.error_description || detail?.error || 'Falha na autenticação');
  }
  return response.json();
}

export function loginWithPassword({ keycloakUrl, realm, clientId, username, password }) {
  return requestToken(keycloakUrl, realm, clientId, { grant_type: 'password', username, password });
}

export function refreshPasswordGrant({ keycloakUrl, realm, clientId, refreshToken }) {
  return requestToken(keycloakUrl, realm, clientId, { grant_type: 'refresh_token', refresh_token: refreshToken });
}

// access_token desse realm é "lightweight" (sem sub/roles) — só o id_token
// carrega o claim de papel (realm_access.roles ou groups, ver AuthProvider).
// Por isso decodificamos o id_token, não o access_token.
export function decodeJwtPayload(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const json = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
      .join(''),
  );
  return JSON.parse(json);
}
