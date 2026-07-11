from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base

# Nomes de coluna e tipos aqui replicam o schema REAL do banco pseudopep_gXX
# do cluster K8S da disciplina (confirmado via psql ao vivo contra o Postgres
# do grupo10) — ver docs/decisions/0006-schema-adaptation.md.


class Patient(Base):
    __tablename__ = "patients"

    patient_id: Mapped[str] = mapped_column(String(20), primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    birth_date: Mapped[date] = mapped_column(Date, nullable=False)
    gender: Mapped[str] = mapped_column(String(20), nullable=False)
    city: Mapped[str] = mapped_column(String(80), nullable=False)
    state: Mapped[str] = mapped_column(String(2), nullable=False)
    cpf: Mapped[str] = mapped_column(String(14), nullable=False)
    cns: Mapped[str] = mapped_column(String(20), nullable=False)

    encounters: Mapped[list["Encounter"]] = relationship(back_populates="patient", lazy="select")
    clinical_events: Mapped[list["ClinicalEvent"]] = relationship(back_populates="patient", lazy="select")


class Encounter(Base):
    __tablename__ = "encounters"

    encounter_id: Mapped[str] = mapped_column(String(20), primary_key=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.patient_id"), nullable=False)
    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    end_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=False))
    # Coluna real é "encounter_type" (não "type").
    type: Mapped[str] = mapped_column("encounter_type", String(40), nullable=False)
    department: Mapped[str] = mapped_column(String(80), nullable=False)

    patient: Mapped["Patient"] = relationship(back_populates="encounters")


class ClinicalEvent(Base):
    __tablename__ = "clinical_events"

    event_id: Mapped[str] = mapped_column(String(20), primary_key=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.patient_id"), nullable=False)
    encounter_id: Mapped[str] = mapped_column(ForeignKey("encounters.encounter_id"), nullable=False)
    # Valores reais: CONDITION / OBSERVATION / MEDICATION (maiúsculas, inglês).
    event_type: Mapped[str] = mapped_column(String(30), nullable=False)
    # Coluna real é "code" (não "event_code").
    event_code: Mapped[str] = mapped_column("code", String(40), nullable=False)
    description: Mapped[str] = mapped_column(String(200), nullable=False)
    event_date: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    # Coluna real é VARCHAR (texto livre, numérico ou qualitativo), não DECIMAL.
    value: Mapped[Optional[str]] = mapped_column(String(80))
    unit: Mapped[Optional[str]] = mapped_column(String(40))

    patient: Mapped["Patient"] = relationship(back_populates="clinical_events")


class UserPatientAssignment(Base):
    __tablename__ = "user_patient_assignments"

    # PK real é uma chave natural (assignment_id, varchar) pré-existente, não
    # um id autoincrement.
    assignment_id: Mapped[str] = mapped_column(String(20), primary_key=True)
    username: Mapped[str] = mapped_column(String(80), nullable=False)
    patient_id: Mapped[str] = mapped_column(String(20), nullable=False)
    # Valores reais: ATTENDING / TRAINEE (não "medico"/"estagiario" — essa é
    # a role do JWT do Keycloak, um vocabulário diferente).
    tipo_vinculo: Mapped[str] = mapped_column("assignment_type", String(20), nullable=False)
    usuario_supervisor: Mapped[Optional[str]] = mapped_column("supervisor_username", String(80))
    # Coluna real é booleana ("active"), não status ('ativo'/'inativo').
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
