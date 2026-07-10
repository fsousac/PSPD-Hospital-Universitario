import json
from collections import Counter
from datetime import date
from typing import Any


def _age(birth_date_str: str) -> int | None:
    try:
        bd = date.fromisoformat(birth_date_str)
        today = date.today()
        return today.year - bd.year - ((today.month, today.day) < (bd.month, bd.day))
    except (ValueError, TypeError):
        return None


def _age_band(age: int) -> str:
    if age < 18:
        return "0-17"
    elif age < 40:
        return "18-39"
    elif age < 60:
        return "40-59"
    else:
        return "60+"


def compute_aggregate(
    clinical_condition: str,
    patients: list[dict],
    events: list[dict],
) -> dict[str, Any]:
    total = len(patients)
    if total == 0:
        return {"clinical_condition": clinical_condition, "total_patients": 0}

    gender_counts: Counter = Counter(p.get("gender", "other") for p in patients)
    gender_dist = {
        "male_pct": round(gender_counts.get("male", 0) / total * 100, 1),
        "female_pct": round(gender_counts.get("female", 0) / total * 100, 1),
        "other_pct": round(gender_counts.get("other", 0) / total * 100, 1),
    }

    age_band_counts: Counter = Counter()
    for p in patients:
        age = _age(p.get("birth_date", ""))
        if age is not None:
            age_band_counts[_age_band(age)] += 1
    age_dist = {
        band: round(age_band_counts.get(band, 0) / total * 100, 1)
        for band in ("0-17", "18-39", "40-59", "60+")
    }

    patient_ids = {p["patient_id"] for p in patients}
    cohort_events = [ev for ev in events if ev.get("patient_id") in patient_ids]

    med_events = [ev for ev in cohort_events if ev.get("event_type") == "Medicação"]
    med_counts: Counter = Counter(ev.get("event_code", "") for ev in med_events)
    top_meds = [
        {"medication": code, "percentage": round(cnt / total * 100, 1)}
        for code, cnt in med_counts.most_common(5)
    ]

    obs_events = [ev for ev in cohort_events if ev.get("event_type") == "Observação"]
    exam_values: dict[str, list[float]] = {}
    exam_units: dict[str, str] = {}
    for ev in obs_events:
        code = ev.get("event_code", "")
        val_str = ev.get("value", "")
        if not val_str:
            continue
        try:
            val = float(val_str)
        except ValueError:
            continue
        exam_values.setdefault(code, []).append(val)
        if ev.get("unit"):
            exam_units[code] = ev["unit"]

    avg_exams = [
        {
            "exam_code": code,
            "avg_value": round(sum(vals) / len(vals), 2),
            "unit": exam_units.get(code, ""),
        }
        for code, vals in exam_values.items()
    ]

    return {
        "clinical_condition": clinical_condition,
        "total_patients": total,
        "gender_distribution": gender_dist,
        "age_distribution": age_dist,
        "top_medications": top_meds,
        "avg_exam_values": avg_exams,
    }


def aggregate_to_json(stats: dict) -> str:
    return json.dumps(stats, ensure_ascii=False, default=str)
