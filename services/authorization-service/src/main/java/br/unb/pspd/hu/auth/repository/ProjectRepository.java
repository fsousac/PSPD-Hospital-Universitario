package br.unb.pspd.hu.auth.repository;

import br.unb.pspd.hu.auth.domain.Project;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.LocalDate;
import java.util.Optional;

// PanacheRepositoryBase<Entity, String>, não PanacheRepository<Entity> (que
// assume PK Long) — project_id é uma chave natural varchar no schema real.
@ApplicationScoped
public class ProjectRepository implements PanacheRepositoryBase<Project, String> {

    // Schema real não tem valid_from — só checa status aprovado + ainda vigente.
    public Optional<Project> findApprovedProject(String username, String projectId) {
        LocalDate today = LocalDate.now();
        return find(
                "researcherUsername = ?1 and projectId = ?2 and status = ?3 and validUntil >= ?4",
                username, projectId, Project.STATUS_APPROVED, today)
                .firstResultOptional();
    }
}
