package br.unb.pspd.hu.auth.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "projects")
public class Project {

    public static final String STATUS_APROVADO = "Aprovado";

    @jakarta.persistence.Id
    @jakarta.persistence.GeneratedValue(strategy = jakarta.persistence.GenerationType.IDENTITY)
    public Long id;

    @Column(name = "project_id", nullable = false, unique = true)
    public String projectId;

    @Column(nullable = false)
    public String username;

    @Column(name = "clinical_condition", nullable = false)
    public String clinicalCondition;

    @Column(nullable = false)
    public String status;

    @Column(name = "valid_from", nullable = false)
    public LocalDate validFrom;

    @Column(name = "valid_until", nullable = false)
    public LocalDate validUntil;

    @Column(name = "created_at", nullable = false)
    public OffsetDateTime createdAt;
}
