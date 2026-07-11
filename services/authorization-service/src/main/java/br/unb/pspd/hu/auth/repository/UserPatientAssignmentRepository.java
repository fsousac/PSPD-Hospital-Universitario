package br.unb.pspd.hu.auth.repository;

import br.unb.pspd.hu.auth.domain.UserPatientAssignment;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;

// PanacheRepositoryBase<Entity, String>, não PanacheRepository<Entity> (que
// assume PK Long) — assignment_id é uma chave natural varchar no schema real.
@ApplicationScoped
public class UserPatientAssignmentRepository implements PanacheRepositoryBase<UserPatientAssignment, String> {

    public boolean existsActiveAssignment(String username, String patientId, String assignmentType) {
        return count(
                "username = ?1 and patientId = ?2 and assignmentType = ?3 and active = true",
                username, patientId, assignmentType) > 0;
    }
}
