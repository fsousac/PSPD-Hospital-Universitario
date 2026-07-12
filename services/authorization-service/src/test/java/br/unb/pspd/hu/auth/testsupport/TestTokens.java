package br.unb.pspd.hu.auth.testsupport;

import io.smallrye.jwt.build.Jwt;
import java.util.List;
import java.util.Map;

/** Gera JWTs assinados com a chave privada de teste (src/test/resources/privateKey.pem). */
public final class TestTokens {

    private TestTokens() {
    }

    public static String forUser(String username, String... roles) {
        return Jwt.issuer("https://issuer.test/realms/hu")
                .subject(username)
                .claim("preferred_username", username)
                .claim("realm_access", Map.of("roles", List.of(roles)))
                .sign();
    }

    /**
     * Simula o formato "lightweight" do realm compartilhado do cluster
     * (grupoXX): sem "realm_access", papel misturado com ruído dentro de
     * "groups" (default-roles-*, offline_access, uma_authorization).
     */
    public static String forUserGroups(String username, String... groups) {
        return Jwt.issuer("https://issuer.test/realms/hu")
                .subject(username)
                .claim("preferred_username", username)
                .claim("groups", List.of(groups))
                .sign();
    }
}
