import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { env } from '../config/env.js';
import { configureApiClient } from '../api/client.js';
import { createKeycloakClient, keycloakInitOptions } from './keycloak.js';
import { decodeJwtPayload, loginWithPassword, refreshPasswordGrant } from './passwordGrant.js';
import { ROLES } from './roles.js';

const AuthContext = createContext(null);

const mockUsers = {
  medico: {
    username: 'dr.silva',
    displayName: 'Dr. Silva',
    roles: [ROLES.DOCTOR],
    token: 'mock-token-medico',
  },
  estagiario: {
    username: 'estagiario.ana',
    displayName: 'Ana Estagiária',
    roles: [ROLES.INTERN],
    token: 'mock-token-estagiario',
  },
  pesquisador: {
    username: 'pesquisador.souza',
    displayName: 'Souza Pesquisador',
    roles: [ROLES.RESEARCHER],
    token: 'mock-token-pesquisador',
  },
};

const roleToMockProfile = {
  [ROLES.DOCTOR]: 'medico',
  [ROLES.INTERN]: 'estagiario',
  [ROLES.RESEARCHER]: 'pesquisador',
};

function normalizeMockProfile(profile) {
  if (mockUsers[profile]) {
    return profile;
  }
  return roleToMockProfile[profile] || 'medico';
}

function getInitialMockProfile() {
  const params = new URLSearchParams(window.location.search);
  return normalizeMockProfile(params.get('perfil') || sessionStorage.getItem('hu_mock_profile') || 'medico');
}

function getInitialMockUser() {
  return mockUsers[getInitialMockProfile()];
}

// Papel do usuário vem de realm_access.roles (realm de dev local "hu") ou do
// claim "groups" (realm real do cluster "grupo10", que não popula
// realm_access nesse client — mesmo fallback usado no backend,
// TokenValidationService.extractRealmRoles, ver docs/decisions/0005).
function getRolesFromTokenParsed(tokenParsed) {
  const fromRealmAccess = tokenParsed?.realm_access?.roles || [];
  const fromGroups = tokenParsed?.groups || [];
  return [...fromRealmAccess, ...fromGroups]
    .map((role) => String(role).replace(/^\//, '').toLowerCase())
    .filter((role) => [ROLES.DOCTOR, ROLES.INTERN, ROLES.RESEARCHER].includes(role));
}

export function AuthProvider({ children }) {
  const [status, setStatus] = useState(() => {
    if (env.authMode === 'mock') return 'authenticated';
    if (env.authMode === 'password') return 'anonymous';
    return 'loading';
  });
  const [user, setUser] = useState(env.authMode === 'mock' ? getInitialMockUser() : null);
  const [keycloak, setKeycloak] = useState(null);
  // ponytail: só em memória (nunca localStorage/sessionStorage) — um reload
  // de página derruba a sessão do modo password, exigindo login de novo.
  // Trade-off aceito por segurança; se incomodar, guardar o refresh_token em
  // sessionStorage resolveria.
  const [passwordTokens, setPasswordTokens] = useState(null);

  useEffect(() => {
    if (env.authMode !== 'keycloak') {
      if (env.authMode === 'mock') {
        sessionStorage.setItem('hu_mock_profile', getInitialMockProfile());
      }
      return undefined;
    }

    const client = createKeycloakClient();
    setKeycloak(client);
    let active = true;

    client
      .init(keycloakInitOptions)
      .then((authenticated) => {
        if (!active) return;
        if (!authenticated) {
          setStatus('anonymous');
          return;
        }
        setUser({
          username: client.tokenParsed?.preferred_username || client.subject,
          displayName: client.tokenParsed?.name || client.tokenParsed?.preferred_username || 'Usuário',
          roles: getRolesFromTokenParsed(client.tokenParsed),
        });
        setStatus('authenticated');
      })
      .catch(() => {
        if (active) setStatus('error');
      });

    const refreshTimer = window.setInterval(() => {
      client.updateToken(60).catch(() => client.logout());
    }, 30000);

    return () => {
      active = false;
      window.clearInterval(refreshTimer);
    };
  }, []);

  const logout = useCallback(() => {
    if (env.authMode === 'mock') {
      sessionStorage.removeItem('hu_mock_profile');
      setUser(mockUsers.medico);
      setStatus('authenticated');
      return;
    }
    if (env.authMode === 'password') {
      setPasswordTokens(null);
      setUser(null);
      setStatus('anonymous');
      return;
    }
    keycloak?.logout();
  }, [keycloak]);

  const login = useCallback(async (usernameOrProfile, password) => {
    if (env.authMode === 'mock') {
      const nextProfile = normalizeMockProfile(usernameOrProfile);
      const nextUser = mockUsers[nextProfile];
      sessionStorage.setItem('hu_mock_profile', nextProfile);
      setUser(nextUser);
      setStatus('authenticated');
      return;
    }
    if (env.authMode === 'password') {
      const result = await loginWithPassword({
        keycloakUrl: env.keycloakUrl,
        realm: env.keycloakRealm,
        clientId: env.passwordGrantClientId,
        username: usernameOrProfile,
        password,
      });
      const payload = decodeJwtPayload(result.id_token);
      setPasswordTokens({ idToken: result.id_token, refreshToken: result.refresh_token });
      setUser({
        username: payload.preferred_username || payload.sub,
        displayName: payload.name || payload.preferred_username || 'Usuário',
        roles: getRolesFromTokenParsed(payload),
      });
      setStatus('authenticated');
      return;
    }
    keycloak?.login();
  }, [keycloak]);

  // Renova o par access/id/refresh token do modo password antes de expirar
  // (grant "password" não tem update automático como o keycloak-js).
  useEffect(() => {
    if (env.authMode !== 'password' || !passwordTokens?.refreshToken) {
      return undefined;
    }
    const refreshTimer = window.setInterval(async () => {
      try {
        const result = await refreshPasswordGrant({
          keycloakUrl: env.keycloakUrl,
          realm: env.keycloakRealm,
          clientId: env.passwordGrantClientId,
          refreshToken: passwordTokens.refreshToken,
        });
        const payload = decodeJwtPayload(result.id_token);
        setPasswordTokens({ idToken: result.id_token, refreshToken: result.refresh_token });
        setUser((prev) => prev && { ...prev, roles: getRolesFromTokenParsed(payload) });
      } catch {
        logout();
      }
    }, 30000);
    return () => window.clearInterval(refreshTimer);
  }, [passwordTokens, logout]);

  const getToken = useCallback(async () => {
    if (env.authMode === 'mock') {
      return user?.token || null;
    }
    if (env.authMode === 'password') {
      return passwordTokens?.idToken || null;
    }
    if (!keycloak) {
      return null;
    }
    await keycloak.updateToken(30);
    return keycloak.token;
  }, [keycloak, user, passwordTokens]);

  const value = useMemo(() => ({
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
    isError: status === 'error',
    user,
    login,
    logout,
    getToken,
  }), [getToken, login, logout, status, user]);

  useLayoutEffect(() => {
    configureApiClient({
      getToken,
      onUnauthorized: logout,
    });
  }, [getToken, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}
