package br.unb.pspd.hu.auth.repository;

import br.unb.pspd.hu.auth.domain.Project;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.LocalDate;
import java.util.Optional;

@ApplicationScoped
public class ProjectRepository implements PanacheRepository<Project> {

    public Optional<Project> findApprovedProject(String username, String projectId) {
        LocalDate today = LocalDate.now();
        return find(
                "username = ?1 and projectId = ?2 and status = ?3 and validFrom <= ?4 and validUntil >= ?4",
                username, projectId, Project.STATUS_APROVADO, today)
                .firstResultOptional();
    }
}
