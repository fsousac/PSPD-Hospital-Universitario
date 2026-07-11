package br.unb.pspd.hu.auth.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Mapeia o schema REAL do banco pseudopep_gXX do cluster K8S da disciplina
 * (colunas/valores confirmados via psql ao vivo contra o Postgres do
 * grupo10 — não é o schema originalmente assumido). A PK é uma chave natural
 * (assignment_id, varchar) pré-existente, não gerada pelo banco.
 *
 * ASSIGNMENT_TYPE_ATTENDING/TRAINEE são valores da COLUNA do banco, distintos
 * das roles do JWT do Keycloak (medico/estagiario) — o mapeamento entre os
 * dois é feito em AuthorizationDecisionService, não aqui.
 */
@Entity
@Table(name = "user_patient_assignments")
public class UserPatientAssignment {

    public static final String ASSIGNMENT_TYPE_ATTENDING = "ATTENDING";
    public static final String ASSIGNMENT_TYPE_TRAINEE = "TRAINEE";

    @Id
    @Column(name = "assignment_id")
    public String assignmentId;

    @Column(nullable = false)
    public String username;

    @Column(name = "patient_id", nullable = false)
    public String patientId;

    @Column(name = "assignment_type", nullable = false)
    public String assignmentType;

    @Column(name = "supervisor_username")
    public String supervisorUsername;

    @Column(nullable = false)
    public boolean active;
}
