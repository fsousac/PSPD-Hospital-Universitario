import Keycloak from 'keycloak-js';
import { env } from '../config/env.js';

export function createKeycloakClient() {
  return new Keycloak({
    url: env.keycloakUrl,
    realm: env.keycloakRealm,
    clientId: env.keycloakClientId,
  });
}

export const keycloakInitOptions = {
  onLoad: 'login-required',
  pkceMethod: 'S256',
  checkLoginIframe: false,
};

