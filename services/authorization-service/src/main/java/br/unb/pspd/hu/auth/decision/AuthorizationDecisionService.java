package br.unb.pspd.hu.auth.decision;

import br.unb.pspd.hu.auth.grpc.AccessLevel;
import br.unb.pspd.hu.auth.grpc.Action;
import br.unb.pspd.hu.auth.grpc.ResourceType;
import br.unb.pspd.hu.auth.domain.Project;
import br.unb.pspd.hu.auth.domain.UserPatientAssignment;
import br.unb.pspd.hu.auth.repository.ProjectRepository;
import br.unb.pspd.hu.auth.repository.UserPatientAssignmentRepository;
import br.unb.pspd.hu.auth.security.JwtClaims;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.List;
import java.util.Optional;

/**
 * As três regras de negócio de autorização (médico / estagiário / pesquisador).
 * Não depende de gRPC nem de contexto Quarkus além dos repositórios — testável
 * com Mockito sem subir banco (ver ADR 0001, decisão 4).
 *
 * IMPORTANTE: as roles do JWT (medico/estagiario/pesquisador, vindas do
 * Keycloak) são um vocabulário diferente do valor da coluna
 * user_patient_assignments.assignment_type no banco real (ATTENDING/TRAINEE)
 * — não são a mesma string reaproveitada. O mapeamento entre os dois é
 * explícito aqui (ver ROLE_TO_ASSIGNMENT_TYPE), não decorre de nomes iguais.
 */
@ApplicationScoped
public class AuthorizationDecisionService {

    private static final String ROLE_MEDICO = "medico";
    private static final String ROLE_ESTAGIARIO = "estagiario";
    private static final String ROLE_PESQUISADOR = "pesquisador";

    // Ordem de prioridade quando o token carrega mais de um papel (não especificado no enunciado).
    private static final List<String> ROLE_PRIORITY = List.of(ROLE_MEDICO, ROLE_ESTAGIARIO, ROLE_PESQUISADOR);

    private final UserPatientAssignmentRepository assignmentRepository;
    private final ProjectRepository projectRepository;

    @Inject
    public AuthorizationDecisionService(
            UserPatientAssignmentRepository assignmentRepository, ProjectRepository projectRepository) {
        this.assignmentRepository = assignmentRepository;
        this.projectRepository = projectRepository;
    }

    public DecisionResult decide(JwtClaims claims, ResourceType resourceType, String resourceId, Action action) {
        String role = ROLE_PRIORITY.stream().filter(claims::hasRole).findFirst().orElse(null);

        if (role == null) {
            return DecisionResult.deny("role não reconhecida no token (esperado: medico, estagiario ou pesquisador)");
        }

        return switch (role) {
            case ROLE_MEDICO -> decidePatientAssignment(
                    claims.username(), resourceType, resourceId, UserPatientAssignment.ASSIGNMENT_TYPE_ATTENDING, AccessLevel.FULL);
            case ROLE_ESTAGIARIO -> decidePatientAssignment(
                    claims.username(), resourceType, resourceId, UserPatientAssignment.ASSIGNMENT_TYPE_TRAINEE, AccessLevel.PARTIAL);
            default -> decidePesquisador(claims.username(), resourceType, resourceId, action);
        };
    }

    private DecisionResult decidePatientAssignment(
            String username, ResourceType resourceType, String patientId, String assignmentType, AccessLevel level) {
        if (resourceType != ResourceType.PATIENT) {
            return DecisionResult.deny("tipo de recurso não suportado para este perfil");
        }
        boolean hasAssignment = assignmentRepository.existsActiveAssignment(username, patientId, assignmentType);
        if (!hasAssignment) {
            return DecisionResult.deny("nenhum vínculo '%s' ativo entre %s e o paciente %s".formatted(assignmentType, username, patientId));
        }
        return DecisionResult.allow(level, "vínculo '%s' ativo encontrado".formatted(assignmentType));
    }

    private DecisionResult decidePesquisador(String username, ResourceType resourceType, String projectId, Action action) {
        if (resourceType != ResourceType.RESEARCH_PROJECT) {
            return DecisionResult.deny("tipo de recurso não suportado para este perfil");
        }
        Optional<Project> project = projectRepository.findApprovedProject(username, projectId);
        if (project.isEmpty()) {
            return DecisionResult.deny(
                    "nenhum projeto aprovado e vigente de %s com id '%s'".formatted(username, projectId));
        }
        String targetConditionCode = project.get().targetConditionCode;
        return switch (action) {
            case AGGREGATE -> DecisionResult.allow(AccessLevel.AGGREGATED,
                    "projeto %s (%s) aprovado — estatística agregada".formatted(projectId, targetConditionCode));
            case READ, LIST -> DecisionResult.allow(AccessLevel.ANONYMIZED,
                    "projeto %s (%s) aprovado — dados anonimizados".formatted(projectId, targetConditionCode));
            default -> DecisionResult.deny("ação não suportada para o perfil pesquisador");
        };
    }

    public record DecisionResult(boolean allowed, AccessLevel accessLevel, String reason) {
        static DecisionResult allow(AccessLevel level, String reason) {
            return new DecisionResult(true, level, reason);
        }

        static DecisionResult deny(String reason) {
            return new DecisionResult(false, AccessLevel.ACCESS_LEVEL_UNSPECIFIED, reason);
        }
    }
}
