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
            rolesArray.forEach(value -> roles.add(value.toString().replace("\"", "")));
        }
        return roles;
    }
}
