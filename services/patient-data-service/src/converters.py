from src.models import ClinicalEvent, Encounter, Patient


def patient_to_dict(p: Patient) -> dict:
    return {
        "patient_id": p.patient_id,
        "full_name": p.full_name,
        "birth_date": str(p.birth_date),
        "gender": p.gender,
        "city": p.city or "",
        "state": p.state or "",
        "cpf": p.cpf or "",
        "cns": p.cns or "",
    }


def encounter_to_dict(e: Encounter) -> dict:
    return {
        "encounter_id": e.encounter_id,
        "patient_id": e.patient_id,
        "start_date": e.start_date.isoformat(),
        "end_date": e.end_date.isoformat() if e.end_date else "",
        "type": e.type,
        "department": e.department or "",
    }


def event_to_dict(ev: ClinicalEvent) -> dict:
    return {
        "event_id": ev.event_id,
        "patient_id": ev.patient_id,
        "encounter_id": ev.encounter_id or "",
        "event_type": ev.event_type,
        "event_code": ev.event_code,
        "description": ev.description or "",
        "event_date": ev.event_date.isoformat(),
        "value": str(ev.value) if ev.value is not None else "",
        "unit": ev.unit or "",
    }
