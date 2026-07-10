from datetime import date, datetime, timezone
from decimal import Decimal

import pytest

from src.converters import event_to_dict, encounter_to_dict, patient_to_dict
from src.models import ClinicalEvent, Encounter, Patient


def make_patient(patient_id="P000001") -> Patient:
    p = Patient()
    p.patient_id = patient_id
    p.full_name = "João da Silva"
    p.birth_date = date(1970, 5, 10)
    p.gender = "male"
    p.city = "Brasília"
    p.state = "DF"
    p.cpf = "111.222.333-44"
    p.cns = "700001234567890"
    return p


def make_encounter(encounter_id="ENC001", patient_id="P000001") -> Encounter:
    e = Encounter()
    e.encounter_id = encounter_id
    e.patient_id = patient_id
    e.start_date = datetime(2025, 1, 10, 8, 0, tzinfo=timezone.utc)
    e.end_date = datetime(2025, 1, 10, 9, 30, tzinfo=timezone.utc)
    e.type = "Ambulatorial"
    e.department = "Endocrinologia"
    return e


def make_event(event_id="CE001", patient_id="P000001", event_type="Condição") -> ClinicalEvent:
    ev = ClinicalEvent()
    ev.event_id = event_id
    ev.patient_id = patient_id
    ev.encounter_id = "ENC001"
    ev.event_type = event_type
    ev.event_code = "diabetes_tipo_2"
    ev.description = "Diabetes Mellitus Tipo 2"
    ev.event_date = datetime(2025, 1, 10, 8, 30, tzinfo=timezone.utc)
    ev.value = Decimal("8.1")
    ev.unit = "%"
    return ev


class TestPatientToDict:
    def test_all_fields(self):
        d = patient_to_dict(make_patient())
        assert d["patient_id"] == "P000001"
        assert d["full_name"] == "João da Silva"
        assert d["birth_date"] == "1970-05-10"
        assert d["gender"] == "male"
        assert d["cpf"] == "111.222.333-44"
        assert d["cns"] == "700001234567890"

    def test_none_optional_fields_become_empty_string(self):
        p = make_patient()
        p.city = None
        p.state = None
        p.cpf = None
        p.cns = None
        d = patient_to_dict(p)
        assert d["city"] == ""
        assert d["state"] == ""
        assert d["cpf"] == ""
        assert d["cns"] == ""

    def test_birth_date_as_string(self):
        d = patient_to_dict(make_patient())
        assert isinstance(d["birth_date"], str)
        assert d["birth_date"] == "1970-05-10"


class TestEncounterToDict:
    def test_all_fields(self):
        d = encounter_to_dict(make_encounter())
        assert d["encounter_id"] == "ENC001"
        assert d["patient_id"] == "P000001"
        assert d["type"] == "Ambulatorial"
        assert d["department"] == "Endocrinologia"

    def test_start_date_isoformat(self):
        d = encounter_to_dict(make_encounter())
        assert "2025-01-10" in d["start_date"]

    def test_end_date_none_becomes_empty(self):
        e = make_encounter()
        e.end_date = None
        d = encounter_to_dict(e)
        assert d["end_date"] == ""

    def test_department_none_becomes_empty(self):
        e = make_encounter()
        e.department = None
        d = encounter_to_dict(e)
        assert d["department"] == ""


class TestEventToDict:
    def test_all_fields(self):
        d = event_to_dict(make_event())
        assert d["event_id"] == "CE001"
        assert d["event_type"] == "Condição"
        assert d["event_code"] == "diabetes_tipo_2"
        assert d["value"] == "8.1"
        assert d["unit"] == "%"

    def test_value_none_becomes_empty(self):
        ev = make_event()
        ev.value = None
        d = event_to_dict(ev)
        assert d["value"] == ""

    def test_unit_none_becomes_empty(self):
        ev = make_event()
        ev.unit = None
        d = event_to_dict(ev)
        assert d["unit"] == ""

    def test_encounter_id_none_becomes_empty(self):
        ev = make_event()
        ev.encounter_id = None
        d = event_to_dict(ev)
        assert d["encounter_id"] == ""

    def test_event_date_isoformat(self):
        d = event_to_dict(make_event())
        assert "2025-01-10" in d["event_date"]

    def test_description_none_becomes_empty(self):
        ev = make_event()
        ev.description = None
        d = event_to_dict(ev)
        assert d["description"] == ""
