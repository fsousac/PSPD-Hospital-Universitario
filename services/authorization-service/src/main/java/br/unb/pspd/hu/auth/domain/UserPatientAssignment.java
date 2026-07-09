package br.unb.pspd.hu.auth.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

@Entity
@Table(name = "user_patient_assignments")
public class UserPatientAssignment {

    public static final String TIPO_MEDICO = "medico";
    public static final String TIPO_ESTAGIARIO = "estagiario";
    public static final String STATUS_ATIVO = "ativo";

    @jakarta.persistence.Id
    @jakarta.persistence.GeneratedValue(strategy = jakarta.persistence.GenerationType.IDENTITY)
    public Long id;

    @Column(nullable = false)
    public String username;

    @Column(name = "patient_id", nullable = false)
    public String patientId;

    @Column(name = "tipo_vinculo", nullable = false)
    public String tipoVinculo;

    @Column(nullable = false)
    public String status;

    @Column(name = "created_at", nullable = false)
    public OffsetDateTime createdAt;
}
