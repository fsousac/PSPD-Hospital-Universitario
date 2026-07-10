export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8088/api',
  authMode: import.meta.env.VITE_AUTH_MODE || 'mock',
  enableMocks: import.meta.env.VITE_ENABLE_MOCKS !== 'false',
  keycloakUrl: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8180',
  keycloakRealm: import.meta.env.VITE_KEYCLOAK_REALM || 'hu',
  keycloakClientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'hu-frontend',
};

