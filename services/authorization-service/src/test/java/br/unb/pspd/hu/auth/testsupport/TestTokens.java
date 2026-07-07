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
}
