from decimal import Decimal
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base


class Patient(Base):
    __tablename__ = "patients"

    patient_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    birth_date: Mapped[date] = mapped_column(Date, nullable=False)
    gender: Mapped[str] = mapped_column(String(10), nullable=False)
    city: Mapped[Optional[str]] = mapped_column(String(100))
    state: Mapped[Optional[str]] = mapped_column(String(50))
    cpf: Mapped[Optional[str]] = mapped_column(String(14))
    cns: Mapped[Optional[str]] = mapped_column(String(20))

    encounters: Mapped[list["Encounter"]] = relationship(back_populates="patient", lazy="select")
    clinical_events: Mapped[list["ClinicalEvent"]] = relationship(back_populates="patient", lazy="select")


class Encounter(Base):
    __tablename__ = "encounters"

    encounter_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.patient_id"), nullable=False)
    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    department: Mapped[Optional[str]] = mapped_column(String(100))

    patient: Mapped["Patient"] = relationship(back_populates="encounters")


class ClinicalEvent(Base):
    __tablename__ = "clinical_events"

    event_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.patient_id"), nullable=False)
    encounter_id: Mapped[Optional[str]] = mapped_column(ForeignKey("encounters.encounter_id"))
    event_type: Mapped[str] = mapped_column(String(20), nullable=False)
    event_code: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(500))
    event_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    value: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 4))
    unit: Mapped[Optional[str]] = mapped_column(String(50))

    patient: Mapped["Patient"] = relationship(back_populates="clinical_events")


class UserPatientAssignment(Base):
    __tablename__ = "user_patient_assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(100), nullable=False)
    patient_id: Mapped[str] = mapped_column(String(50), nullable=False)
    tipo_vinculo: Mapped[str] = mapped_column(String(20), nullable=False)
    usuario_supervisor: Mapped[Optional[str]] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), nullable=False)
