import json

import pytest

from src.transformers.fhir_mapper import (
    patient_to_fhir,
    encounter_to_fhir,
    clinical_event_to_fhir,
    build_bundle,
)

PATIENT = {
    "patient_id": "P000001",
    "full_name": "João da Silva",
    "birth_date": "1970-05-10",
    "gender": "male",
    "city": "Brasília",
    "state": "DF",
    "cpf": "111.222.333-44",
    "cns": "700001234567890",
}

ENCOUNTER = {
    "encounter_id": "ENC001",
    "patient_id": "P000001",
    "start_date": "2025-01-10T08:00:00+00:00",
    "end_date": "2025-01-10T09:30:00+00:00",
    "type": "Ambulatorial",
    "department": "Endocrinologia",
}

EVENT_CONDITION = {
    "event_id": "CE001",
    "patient_id": "P000001",
    "encounter_id": "ENC001",
    "event_type": "Condição",
    "event_code": "diabetes_tipo_2",
    "description": "Diabetes Mellitus Tipo 2",
    "event_date": "2025-01-10T08:00:00+00:00",
    "value": "",
    "unit": "",
}

EVENT_OBSERVATION = {
    "event_id": "CE009",
    "patient_id": "P000001",
    "encounter_id": "ENC001",
    "event_type": "Observação",
    "event_code": "HbA1c",
    "description": "Hemoglobina Glicada",
    "event_date": "2025-01-10T08:30:00+00:00",
    "value": "8.1",
    "unit": "%",
}

EVENT_MEDICATION = {
    "event_id": "CE018",
    "patient_id": "P000001",
    "encounter_id": "ENC001",
    "event_type": "Medicação",
    "event_code": "Metformina_850mg",
    "description": "Metformina 850 mg",
    "event_date": "2025-01-10T08:00:00+00:00",
    "value": "850.0",
    "unit": "mg",
}


class TestPatientToFhir:
    def test_resource_type(self):
        r = patient_to_fhir(PATIENT)
        assert r["resourceType"] == "Patient"

    def test_id(self):
        r = patient_to_fhir(PATIENT)
        assert r["id"] == "P000001"

    def test_name(self):
        r = patient_to_fhir(PATIENT)
        assert r["name"][0]["text"] == "João da Silva"

    def test_birth_date(self):
        r = patient_to_fhir(PATIENT)
        assert r["birthDate"] == "1970-05-10"

    def test_gender(self):
        r = patient_to_fhir(PATIENT)
        assert r["gender"] == "male"

    def test_address(self):
        r = patient_to_fhir(PATIENT)
        assert r["address"][0]["city"] == "Brasília"
        assert r["address"][0]["state"] == "DF"

    def test_identifiers(self):
        r = patient_to_fhir(PATIENT)
        assert len(r["identifier"]) == 2

    def test_age_band_in_extension(self):
        p = dict(PATIENT, birth_date="60+", full_name="")
        r = patient_to_fhir(p)
        assert "extension" in r
        assert r["extension"][0]["valueString"] == "60+"
        assert "birthDate" not in r

    def test_empty_name_omitted(self):
        p = dict(PATIENT, full_name="")
        r = patient_to_fhir(p)
        assert "name" not in r


class TestEncounterToFhir:
    def test_resource_type(self):
        r = encounter_to_fhir(ENCOUNTER)
        assert r["resourceType"] == "Encounter"

    def test_id(self):
        r = encounter_to_fhir(ENCOUNTER)
        assert r["id"] == "ENC001"

    def test_subject_reference(self):
        r = encounter_to_fhir(ENCOUNTER)
        assert r["subject"]["reference"] == "Patient/P000001"

    def test_department(self):
        r = encounter_to_fhir(ENCOUNTER)
        assert r["serviceType"]["text"] == "Endocrinologia"

    def test_period(self):
        r = encounter_to_fhir(ENCOUNTER)
        assert "period" in r
        assert "start" in r["period"]


class TestClinicalEventToFhir:
    def test_condition(self):
        r = clinical_event_to_fhir(EVENT_CONDITION)
        assert r["resourceType"] == "Condition"
        assert r["id"] == "CE001"
        assert r["code"]["coding"][0]["code"] == "diabetes_tipo_2"

    def test_observation(self):
        r = clinical_event_to_fhir(EVENT_OBSERVATION)
        assert r["resourceType"] == "Observation"
        assert r["status"] == "final"
        assert r["valueQuantity"]["value"] == pytest.approx(8.1)
        assert r["valueQuantity"]["unit"] == "%"

    def test_medication_request(self):
        r = clinical_event_to_fhir(EVENT_MEDICATION)
        assert r["resourceType"] == "MedicationRequest"
        assert r["medicationCodeableConcept"]["text"] == "Metformina 850 mg"

    def test_unknown_type_returns_none(self):
        ev = dict(EVENT_CONDITION, event_type="Desconhecido")
        assert clinical_event_to_fhir(ev) is None


class TestBuildBundle:
    def test_bundle_structure(self):
        entries = [patient_to_fhir(PATIENT), encounter_to_fhir(ENCOUNTER)]
        payload = build_bundle(entries)
        bundle = json.loads(payload)
        assert bundle["resourceType"] == "Bundle"
        assert bundle["type"] == "searchset"
        assert bundle["total"] == 2
        assert len(bundle["entry"]) == 2

    def test_entries_wrapped(self):
        entries = [patient_to_fhir(PATIENT)]
        bundle = json.loads(build_bundle(entries))
        assert "resource" in bundle["entry"][0]
