import json
from datetime import datetime
from typing import Any


def patient_to_fhir(p: dict) -> dict:
    resource: dict[str, Any] = {"resourceType": "Patient"}

    patient_id = p.get("patient_id", "")
    resource["id"] = patient_id

    full_name = p.get("full_name", "")
    if full_name:
        resource["name"] = [{"text": full_name}]

    birth_date = p.get("birth_date", "")
    if birth_date:
        # Para ANONYMIZED birth_date contém faixa etária — não vai em birthDate FHIR
        if _is_date(birth_date):
            resource["birthDate"] = birth_date
        else:
            resource["extension"] = [
                {
                    "url": "https://hu.unb.br/fhir/StructureDefinition/age-band",
                    "valueString": birth_date,
                }
            ]

    gender = p.get("gender", "")
    if gender:
        resource["gender"] = gender

    city = p.get("city", "")
    state = p.get("state", "")
    if city or state:
        resource["address"] = [{"city": city, "state": state}]

    cpf = p.get("cpf", "")
    cns = p.get("cns", "")
    identifiers = []
    if cpf:
        identifiers.append({"system": "urn:oid:2.16.840.1.113883.13.237", "value": cpf})
    if cns:
        identifiers.append({"system": "urn:oid:2.16.840.1.113883.13.236", "value": cns})
    if identifiers:
        resource["identifier"] = identifiers

    return resource


def encounter_to_fhir(e: dict) -> dict:
    resource: dict[str, Any] = {
        "resourceType": "Encounter",
        "id": e.get("encounter_id", ""),
        "status": "finished",
        "subject": {"reference": f"Patient/{e.get('patient_id', '')}"},
    }

    enc_type = e.get("type", "")
    if enc_type:
        resource["class"] = {"display": enc_type}

    dept = e.get("department", "")
    if dept:
        resource["serviceType"] = {"text": dept}

    start = e.get("start_date", "")
    end = e.get("end_date", "")
    if start or end:
        resource["period"] = {}
        if start:
            resource["period"]["start"] = start
        if end:
            resource["period"]["end"] = end

    return resource


def clinical_event_to_fhir(ev: dict) -> dict | None:
    # Valores reais de event_type são maiúsculos em inglês — schema
    # confirmado ao vivo contra o Postgres do cluster.
    event_type = ev.get("event_type", "")
    if event_type == "CONDITION":
        return _condition(ev)
    elif event_type == "OBSERVATION":
        return _observation(ev)
    elif event_type == "MEDICATION":
        return _medication_request(ev)
    return None


def _condition(ev: dict) -> dict:
    return {
        "resourceType": "Condition",
        "id": ev.get("event_id", ""),
        "subject": {"reference": f"Patient/{ev.get('patient_id', '')}"},
        "encounter": {"reference": f"Encounter/{ev.get('encounter_id', '')}"},
        "code": {
            "coding": [{"code": ev.get("event_code", ""), "display": ev.get("description", "")}],
            "text": ev.get("description", ev.get("event_code", "")),
        },
        "onsetDateTime": ev.get("event_date", ""),
    }


def _observation(ev: dict) -> dict:
    obs: dict[str, Any] = {
        "resourceType": "Observation",
        "id": ev.get("event_id", ""),
        "status": "final",
        "subject": {"reference": f"Patient/{ev.get('patient_id', '')}"},
        "encounter": {"reference": f"Encounter/{ev.get('encounter_id', '')}"},
        "code": {
            "coding": [{"code": ev.get("event_code", ""), "display": ev.get("description", "")}],
            "text": ev.get("description", ev.get("event_code", "")),
        },
        "effectiveDateTime": ev.get("event_date", ""),
    }
    value = ev.get("value", "")
    unit = ev.get("unit", "")
    if value:
        try:
            obs["valueQuantity"] = {"value": float(value), "unit": unit}
        except (ValueError, TypeError):
            obs["valueString"] = value
    return obs


def _medication_request(ev: dict) -> dict:
    return {
        "resourceType": "MedicationRequest",
        "id": ev.get("event_id", ""),
        "status": "active",
        "intent": "order",
        "subject": {"reference": f"Patient/{ev.get('patient_id', '')}"},
        "encounter": {"reference": f"Encounter/{ev.get('encounter_id', '')}"},
        "medicationCodeableConcept": {
            "coding": [{"code": ev.get("event_code", ""), "display": ev.get("description", "")}],
            "text": ev.get("description", ev.get("event_code", "")),
        },
        "authoredOn": ev.get("event_date", ""),
    }


FHIR_RESOURCE_TYPES = {
    "Patient", "Encounter", "Condition", "Observation", "MedicationRequest"
}


def build_bundle(entries: list[dict], bundle_type: str = "searchset") -> str:
    bundle = {
        "resourceType": "Bundle",
        "type": bundle_type,
        "total": len(entries),
        "entry": [{"resource": r} for r in entries],
    }
    return json.dumps(bundle, ensure_ascii=False, default=str)


def _is_date(value: str) -> bool:
    if not value or len(value) < 4:
        return False
    try:
        datetime.strptime(value[:10], "%Y-%m-%d")
        return True
    except ValueError:
        return False
