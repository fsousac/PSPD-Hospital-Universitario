package br.unb.pspd.hu.auth.repository;

import br.unb.pspd.hu.auth.domain.UserPatientAssignment;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class UserPatientAssignmentRepository implements PanacheRepository<UserPatientAssignment> {

    public boolean existsActiveAssignment(String username, String patientId, String tipoVinculo) {
        return count(
                "username = ?1 and patientId = ?2 and tipoVinculo = ?3 and status = ?4",
                username, patientId, tipoVinculo, UserPatientAssignment.STATUS_ATIVO) > 0;
    }
}
