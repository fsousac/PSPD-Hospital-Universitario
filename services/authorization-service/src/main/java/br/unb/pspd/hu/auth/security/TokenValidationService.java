package br.unb.pspd.hu.auth.security;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.json.JsonArray;
import jakarta.json.JsonObject;
import java.util.LinkedHashSet;
import java.util.Set;
import io.smallrye.jwt.auth.principal.JWTParser;
import io.smallrye.jwt.auth.principal.ParseException;
import org.eclipse.microprofile.jwt.JsonWebToken;

/**
 * Valida/parseia o JWT que chega no corpo da mensagem gRPC (não no header
 * "authorization" da chamada) — ver ADR 0001. Usa o JWTParser do
 * quarkus-smallrye-jwt, configurado contra o JWKS do mesmo realm Keycloak
 * usado pelo quarkus-oidc.
 */
@ApplicationScoped
public class TokenValidationService {

    // Papéis de aplicação reconhecidos, para filtrar ruído do claim "groups"
    // (default-roles-*, offline_access, uma_authorization — ver extractRealmRoles).
    private static final Set<String> KNOWN_ROLES = Set.of("medico", "estagiario", "pesquisador");

    @Inject
    JWTParser jwtParser;

    public JwtClaims validate(String rawToken) {
        JsonWebToken jwt;
        try {
            jwt = jwtParser.parse(rawToken);
        } catch (ParseException e) {
            throw new InvalidTokenException("JWT inválido ou assinatura não confere", e);
        }

        String username = jwt.getClaim("preferred_username");
        if (username == null || username.isBlank()) {
            username = jwt.getSubject();
        }

        return new JwtClaims(username, extractRealmRoles(jwt));
    }

    private Set<String> extractRealmRoles(JsonWebToken jwt) {
        Set<String> roles = new LinkedHashSet<>();
        JsonObject realmAccess = jwt.getClaim("realm_access");
        if (realmAccess != null && realmAccess.containsKey("roles")) {
            JsonArray rolesArray = realmAccess.getJsonArray("roles");
            // Normalizado para minúsculas: o realm "hu" local usa roles minúsculas,
            // mas o realm compartilhado do cluster (grupoXX) provisiona MEDICO/
            // ESTAGIARIO/PESQUISADOR em maiúsculas. Comparação é sempre lowercase.
            rolesArray.forEach(value -> roles.add(value.toString().replace("\"", "").toLowerCase()));
            return roles;
        }

        // Fallback: o realm compartilhado do cluster emite tokens "lightweight"
        // sem "realm_access", mas o claim "groups" (client scope microprofile-jwt)
        // carrega o papel junto com ruído (default-roles-*, offline_access,
        // uma_authorization) — filtramos para KNOWN_ROLES. Ver docs/decisions/0005.
        // "groups" é claim padrão do MicroProfile JWT (diferente de "realm_access",
        // que é custom do Keycloak) — o JsonWebToken já desserializa como
        // Set<String> via getGroups(), não como JsonArray (getClaim daria
        // ClassCastException: HashSet -> JsonArray).
        Set<String> groups = jwt.getGroups();
        if (groups != null) {
            groups.forEach(value -> {
                String group = value.toLowerCase();
                if (KNOWN_ROLES.contains(group)) {
                    roles.add(group);
                }
            });
        }
        return roles;
    }
}
