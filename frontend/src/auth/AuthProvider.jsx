import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { env } from '../config/env.js';
import { configureApiClient } from '../api/client.js';
import { createKeycloakClient, keycloakInitOptions } from './keycloak.js';
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

function getRolesFromTokenParsed(tokenParsed) {
  return tokenParsed?.realm_access?.roles?.filter((role) =>
    [ROLES.DOCTOR, ROLES.INTERN, ROLES.RESEARCHER].includes(role),
  ) || [];
}

export function AuthProvider({ children }) {
  const [status, setStatus] = useState(env.authMode === 'mock' ? 'authenticated' : 'loading');
  const [user, setUser] = useState(env.authMode === 'mock' ? getInitialMockUser() : null);
  const [keycloak, setKeycloak] = useState(null);

  useEffect(() => {
    if (env.authMode === 'mock') {
      sessionStorage.setItem('hu_mock_profile', getInitialMockProfile());
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

  const login = useCallback((profile) => {
    if (env.authMode === 'mock') {
      const nextProfile = normalizeMockProfile(profile);
      const nextUser = mockUsers[nextProfile];
      sessionStorage.setItem('hu_mock_profile', nextProfile);
      setUser(nextUser);
      setStatus('authenticated');
      return;
    }
    keycloak?.login();
  }, [keycloak]);

  const logout = useCallback(() => {
    if (env.authMode === 'mock') {
      sessionStorage.removeItem('hu_mock_profile');
      setUser(mockUsers.medico);
      setStatus('authenticated');
      return;
    }
    keycloak?.logout();
  }, [keycloak]);

  const getToken = useCallback(async () => {
    if (env.authMode === 'mock') {
      return user?.token || null;
    }
    if (!keycloak) {
      return null;
    }
    await keycloak.updateToken(30);
    return keycloak.token;
  }, [keycloak, user]);

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
