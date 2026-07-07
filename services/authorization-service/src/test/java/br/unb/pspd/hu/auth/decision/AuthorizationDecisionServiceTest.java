package br.unb.pspd.hu.auth.decision;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

import br.unb.pspd.hu.auth.domain.Project;
import br.unb.pspd.hu.auth.grpc.AccessLevel;
import br.unb.pspd.hu.auth.grpc.Action;
import br.unb.pspd.hu.auth.grpc.ResourceType;
import br.unb.pspd.hu.auth.repository.ProjectRepository;
import br.unb.pspd.hu.auth.repository.UserPatientAssignmentRepository;
import br.unb.pspd.hu.auth.security.JwtClaims;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Testes unitários das 3 regras de decisão — repositórios mockados, sem
 * subir Quarkus/banco (contraste com AuthorizationGrpcServiceIT, que é o
 * teste de integração ponta a ponta).
 */
@ExtendWith(MockitoExtension.class)
class AuthorizationDecisionServiceTest {

    @Mock
    UserPatientAssignmentRepository assignmentRepository;

    @Mock
    ProjectRepository projectRepository;

    AuthorizationDecisionService service;

    @BeforeEach
    void setUp() {
        service = new AuthorizationDecisionService(assignmentRepository, projectRepository);
    }

    @Test
    void medicoComVinculoAtivoRecebeAcessoFull() {
        when(assignmentRepository.existsActiveAssignment("dr.silva", "P000001", "medico")).thenReturn(true);

        var result = service.decide(
                new JwtClaims("dr.silva", Set.of("medico")), ResourceType.PATIENT, "P000001", Action.READ);

        assertTrue(result.allowed());
        assertEquals(AccessLevel.FULL, result.accessLevel());
    }

    @Test
    void medicoSemVinculoRecebeDeny() {
        when(assignmentRepository.existsActiveAssignment("dr.silva", "P999999", "medico")).thenReturn(false);

        var result = service.decide(
                new JwtClaims("dr.silva", Set.of("medico")), ResourceType.PATIENT, "P999999", Action.READ);

        assertFalse(result.allowed());
        assertEquals(AccessLevel.ACCESS_LEVEL_UNSPECIFIED, result.accessLevel());
    }

    @Test
    void estagiarioComVinculoAtivoRecebeAcessoPartial() {
        when(assignmentRepository.existsActiveAssignment("estagiario.ana", "P000001", "estagiario")).thenReturn(true);

        var result = service.decide(
                new JwtClaims("estagiario.ana", Set.of("estagiario")), ResourceType.PATIENT, "P000001", Action.READ);

        assertTrue(result.allowed());
        assertEquals(AccessLevel.PARTIAL, result.accessLevel());
    }

    @Test
    void estagiarioSemVinculoRecebeDeny() {
        when(assignmentRepository.existsActiveAssignment("estagiario.ana", "P000002", "estagiario")).thenReturn(false);

        var result = service.decide(
                new JwtClaims("estagiario.ana", Set.of("estagiario")), ResourceType.PATIENT, "P000002", Action.READ);

        assertFalse(result.allowed());
    }

    @Test
    void pesquisadorComProjetoAprovadoLeituraRecebeAnonymized() {
        Project project = new Project();
        project.projectId = "PRJ01";
        project.clinicalCondition = "diabetes_tipo_2";
        when(projectRepository.findApprovedProject("pesquisador.souza", "PRJ01"))
                .thenReturn(Optional.of(project));

        var result = service.decide(
                new JwtClaims("pesquisador.souza", Set.of("pesquisador")),
                ResourceType.RESEARCH_PROJECT, "PRJ01", Action.READ);

        assertTrue(result.allowed());
        assertEquals(AccessLevel.ANONYMIZED, result.accessLevel());
    }

    @Test
    void pesquisadorComProjetoAprovadoEstatisticaRecebeAggregated() {
        Project project = new Project();
        project.projectId = "PRJ01";
        project.clinicalCondition = "diabetes_tipo_2";
        when(projectRepository.findApprovedProject("pesquisador.souza", "PRJ01"))
                .thenReturn(Optional.of(project));

        var result = service.decide(
                new JwtClaims("pesquisador.souza", Set.of("pesquisador")),
                ResourceType.RESEARCH_PROJECT, "PRJ01", Action.AGGREGATE);

        assertTrue(result.allowed());
        assertEquals(AccessLevel.AGGREGATED, result.accessLevel());
    }

    @Test
    void pesquisadorComProjetoExpiradoOuSuspensoRecebeDeny() {
        // findApprovedProject já filtra status='Aprovado' e vigência na query — projeto
        // suspenso/expirado simplesmente não é encontrado.
        when(projectRepository.findApprovedProject("pesquisador.souza", "PRJ02"))
                .thenReturn(Optional.empty());

        var result = service.decide(
                new JwtClaims("pesquisador.souza", Set.of("pesquisador")),
                ResourceType.RESEARCH_PROJECT, "PRJ02", Action.READ);

        assertFalse(result.allowed());
        assertEquals(AccessLevel.ACCESS_LEVEL_UNSPECIFIED, result.accessLevel());
    }

    @Test
    void roleDesconhecidaRecebeDenySemConsultarRepositorios() {
        var result = service.decide(
                new JwtClaims("alguem", Set.of("enfermeiro")), ResourceType.PATIENT, "P000001", Action.READ);

        assertFalse(result.allowed());
    }

    @Test
    void medicoConsultandoRecursoQueNaoEhPacienteRecebeDeny() {
        var result = service.decide(
                new JwtClaims("dr.silva", Set.of("medico")), ResourceType.RESEARCH_PROJECT, "diabetes", Action.READ);

        assertFalse(result.allowed());
    }
}
