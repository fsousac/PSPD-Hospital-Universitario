package br.unb.pspd.hu.auth.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;

/**
 * Mapeia o schema REAL do banco pseudopep_gXX do cluster K8S da disciplina
 * (ver nota em UserPatientAssignment.java). PK é chave natural (project_id).
 * Não existe coluna valid_from no schema real — só valid_until.
 */
@Entity
@Table(name = "projects")
public class Project {

    public static final String STATUS_APPROVED = "APPROVED";

    @Id
    @Column(name = "project_id")
    public String projectId;

    @Column(nullable = false)
    public String title;

    @Column(name = "researcher_username", nullable = false)
    public String researcherUsername;

    @Column(name = "target_condition_code", nullable = false)
    public String targetConditionCode;

    @Column(nullable = false)
    public String status;

    @Column(name = "valid_until", nullable = false)
    public LocalDate validUntil;
}
