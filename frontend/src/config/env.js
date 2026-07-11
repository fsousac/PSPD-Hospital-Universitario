export const env = {
  // Empty means same-origin. The Vite/Nginx proxy forwards /api to the Gateway.
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  authMode: import.meta.env.VITE_AUTH_MODE || 'mock',
  enableMocks: import.meta.env.VITE_ENABLE_MOCKS !== 'false',
  keycloakUrl: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8180',
  keycloakRealm: import.meta.env.VITE_KEYCLOAK_REALM || 'hu',
  keycloakClientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'hu-frontend',
};
