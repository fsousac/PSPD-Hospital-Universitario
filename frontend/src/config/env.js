export const env = {
  // Falls back to the app's own base path (Vite's BASE_URL, set via
  // VITE_BASE_PATH) so absolute paths like "/api/..." stay under
  // "/grupo10" when served behind the Apache/ingress prefix routing
  // (see k8s/ingress.yaml) instead of resolving to the domain root.
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || import.meta.env.BASE_URL.replace(/\/$/, ''),
  authMode: import.meta.env.VITE_AUTH_MODE || 'mock',
  enableMocks: import.meta.env.VITE_ENABLE_MOCKS !== 'false',
  keycloakUrl: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8180',
  keycloakRealm: import.meta.env.VITE_KEYCLOAK_REALM || 'hu',
  keycloakClientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'hu-frontend',
  // Usado só quando authMode === 'password' (ver src/auth/passwordGrant.js).
  passwordGrantClientId: import.meta.env.VITE_PASSWORD_GRANT_CLIENT_ID || 'admin-cli',
};
