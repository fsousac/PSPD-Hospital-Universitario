package br.unb.pspd.hu.auth.security;

import java.util.Set;

/** Claims relevantes extraídas do JWT do Keycloak, já normalizadas para o domínio do serviço. */
public record JwtClaims(String username, Set<String> roles) {

    public boolean hasRole(String role) {
        return roles.contains(role);
    }
}
