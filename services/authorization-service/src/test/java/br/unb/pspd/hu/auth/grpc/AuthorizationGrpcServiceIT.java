package br.unb.pspd.hu.auth.grpc;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import br.unb.pspd.hu.auth.testsupport.TestTokens;
import io.quarkus.grpc.GrpcClient;
import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

/**
 * Teste de integração ponta a ponta: request gRPC real -> validação de JWT ->
 * consulta ao PostgreSQL (Quarkus Dev Services / Testcontainers, subido
 * automaticamente pois %test não define quarkus.datasource.jdbc.url) ->
 * resposta. Dados semeados em src/test/resources/import.sql.
 */
@QuarkusTest
class AuthorizationGrpcServiceIT {

    @GrpcClient("authorization-service")
    AuthorizationService client;

    @Test
    void medicoComVinculoAtivoObtemAcessoFull() {
        String token = TestTokens.forUser("dr.silva", "medico");

        AuthorizeResponse response = client.authorize(AuthorizeRequest.newBuilder()
                        .setJwtToken(token)
                        .setResourceType(ResourceType.PATIENT)
                        .setResourceId("P000001")
                        .setAction(Action.READ)
                        .build())
                .await().indefinitely();

        assertTrue(response.getAllowed());
        assertEquals(AccessLevel.FULL, response.getAccessLevel());
        assertEquals("dr.silva", response.getSubjectId());
    }

    @Test
    void medicoComRoleEmMaiusculasObtemAcessoFull() {
        // Regressão: o realm compartilhado do cluster (grupoXX) provisiona
        // roles em maiúsculas (MEDICO/ESTAGIARIO/PESQUISADOR), diferente do
        // realm "hu" local (minúsculas). A extração de role deve ser
        // case-insensitive — ver TokenValidationService.extractRealmRoles.
        String token = TestTokens.forUser("dr.silva", "MEDICO");

        AuthorizeResponse response = client.authorize(AuthorizeRequest.newBuilder()
                        .setJwtToken(token)
                        .setResourceType(ResourceType.PATIENT)
                        .setResourceId("P000001")
                        .setAction(Action.READ)
                        .build())
                .await().indefinitely();

        assertTrue(response.getAllowed());
        assertEquals(AccessLevel.FULL, response.getAccessLevel());
    }

    @Test
    void medicoSemVinculoAtivoEDeny() {
        String token = TestTokens.forUser("dr.silva", "medico");

        // P000002 está com active=false no seed (import.sql).
        AuthorizeResponse response = client.authorize(AuthorizeRequest.newBuilder()
                        .setJwtToken(token)
                        .setResourceType(ResourceType.PATIENT)
                        .setResourceId("P000002")
                        .setAction(Action.READ)
                        .build())
                .await().indefinitely();

        assertFalse(response.getAllowed());
    }

    @Test
    void pesquisadorComProjetoSuspensoEDeny() {
        String token = TestTokens.forUser("pesquisador.souza", "pesquisador");

        // PRJ02 está com status 'SUSPENDED' no seed.
        AuthorizeResponse response = client.authorize(AuthorizeRequest.newBuilder()
                        .setJwtToken(token)
                        .setResourceType(ResourceType.RESEARCH_PROJECT)
                        .setResourceId("PRJ02")
                        .setAction(Action.AGGREGATE)
                        .build())
                .await().indefinitely();

        assertFalse(response.getAllowed());
    }

    @Test
    void tokenInvalidoEDenyComMotivo() {
        AuthorizeResponse response = client.authorize(AuthorizeRequest.newBuilder()
                        .setJwtToken("token-nao-assinado-invalido")
                        .setResourceType(ResourceType.PATIENT)
                        .setResourceId("P000001")
                        .setAction(Action.READ)
                        .build())
                .await().indefinitely();

        assertFalse(response.getAllowed());
        assertFalse(response.getReason().isBlank());
    }

    @Test
    void validateTokenComTokenValidoRetornaRoles() {
        String token = TestTokens.forUser("estagiario.ana", "estagiario");

        ValidateTokenResponse response = client
                .validateToken(ValidateTokenRequest.newBuilder().setJwtToken(token).build())
                .await().indefinitely();

        assertTrue(response.getValid());
        assertEquals("estagiario.ana", response.getSubjectId());
        assertTrue(response.getRolesList().contains("estagiario"));
    }
}
