import hashlib
from datetime import date
from typing import Any


def _age_band(birth_date_str: str) -> str:
    try:
        bd = date.fromisoformat(birth_date_str)
    except (ValueError, TypeError):
        return "desconhecido"
    today = date.today()
    age = today.year - bd.year - ((today.month, today.day) < (bd.month, bd.day))
    if age < 18:
        return "0-17"
    elif age < 40:
        return "18-39"
    elif age < 60:
        return "40-59"
    else:
        return "60+"


def _initials(full_name: str) -> str:
    parts = [p for p in full_name.strip().split() if len(p) > 2]
    if not parts:
        return full_name[:1] + "." if full_name else ""
    if len(parts) == 1:
        return parts[0][0] + "."
    return parts[0][0] + ". " + parts[-1][0] + "."


def _pseudonym(patient_id: str) -> str:
    digest = hashlib.sha256(patient_id.encode()).hexdigest()[:12]
    return f"hash-{digest}"


def apply_partial(patient: dict) -> dict:
    out = dict(patient)
    out["full_name"] = _initials(patient.get("full_name", ""))
    out["cpf"] = ""
    out["cns"] = ""
    birth = patient.get("birth_date", "")
    out["birth_date"] = birth[:4] if len(birth) >= 4 else birth  # apenas ano
    return out


def apply_anonymized(patient: dict) -> dict:
    out = dict(patient)
    original_id = patient.get("patient_id", "")
    out["patient_id"] = _pseudonym(original_id)
    out["full_name"] = ""
    out["cpf"] = ""
    out["cns"] = ""
    out["city"] = ""
    out["birth_date"] = _age_band(patient.get("birth_date", ""))
    return out
