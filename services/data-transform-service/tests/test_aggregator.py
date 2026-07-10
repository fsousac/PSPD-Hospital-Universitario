import json

import pytest

from src.transformers.aggregator import compute_aggregate, aggregate_to_json

PATIENTS = [
    {"patient_id": "P000001", "birth_date": "1970-05-10", "gender": "male"},
    {"patient_id": "P000005", "birth_date": "1955-12-01", "gender": "male"},
    {"patient_id": "P000006", "birth_date": "1978-09-30", "gender": "female"},
    {"patient_id": "P000009", "birth_date": "1963-08-25", "gender": "male"},
]

EVENTS = [
    {"event_id": "CE001", "patient_id": "P000001", "event_type": "Condição",   "event_code": "diabetes_tipo_2", "event_date": "2023-01-10", "value": "",    "unit": ""},
    {"event_id": "CE004", "patient_id": "P000005", "event_type": "Condição",   "event_code": "diabetes_tipo_2", "event_date": "2022-06-01", "value": "",    "unit": ""},
    {"event_id": "CE005", "patient_id": "P000006", "event_type": "Condição",   "event_code": "diabetes_tipo_2", "event_date": "2024-11-03", "value": "",    "unit": ""},
    {"event_id": "CE007", "patient_id": "P000009", "event_type": "Condição",   "event_code": "diabetes_tipo_2", "event_date": "2021-09-10", "value": "",    "unit": ""},
    {"event_id": "CE009", "patient_id": "P000001", "event_type": "Observação", "event_code": "HbA1c",           "event_date": "2025-01-10", "value": "8.1", "unit": "%"},
    {"event_id": "CE013", "patient_id": "P000005", "event_type": "Observação", "event_code": "HbA1c",           "event_date": "2025-01-22", "value": "7.4", "unit": "%"},
    {"event_id": "CE015", "patient_id": "P000006", "event_type": "Observação", "event_code": "HbA1c",           "event_date": "2025-05-03", "value": "9.2", "unit": "%"},
    {"event_id": "CE016", "patient_id": "P000009", "event_type": "Observação", "event_code": "HbA1c",           "event_date": "2025-02-28", "value": "7.8", "unit": "%"},
    {"event_id": "CE018", "patient_id": "P000001", "event_type": "Medicação",  "event_code": "Metformina_850mg","event_date": "2025-01-10", "value": "850", "unit": "mg"},
    {"event_id": "CE021", "patient_id": "P000005", "event_type": "Medicação",  "event_code": "Metformina_850mg","event_date": "2025-01-22", "value": "850", "unit": "mg"},
    {"event_id": "CE022", "patient_id": "P000006", "event_type": "Medicação",  "event_code": "Insulina_NPH",    "event_date": "2025-05-03", "value": "20",  "unit": "UI"},
    {"event_id": "CE024", "patient_id": "P000009", "event_type": "Medicação",  "event_code": "Metformina_850mg","event_date": "2025-02-28", "value": "850", "unit": "mg"},
]


class TestComputeAggregate:
    def test_total_patients(self):
        result = compute_aggregate("diabetes_tipo_2", PATIENTS, EVENTS)
        assert result["total_patients"] == 4

    def test_gender_distribution_sum(self):
        result = compute_aggregate("diabetes_tipo_2", PATIENTS, EVENTS)
        gd = result["gender_distribution"]
        total = gd["male_pct"] + gd["female_pct"] + gd["other_pct"]
        assert abs(total - 100.0) < 0.5

    def test_male_majority(self):
        result = compute_aggregate("diabetes_tipo_2", PATIENTS, EVENTS)
        assert result["gender_distribution"]["male_pct"] > 50

    def test_age_distribution_present(self):
        result = compute_aggregate("diabetes_tipo_2", PATIENTS, EVENTS)
        ad = result["age_distribution"]
        assert "40-59" in ad
        assert "60+" in ad

    def test_top_medications_present(self):
        result = compute_aggregate("diabetes_tipo_2", PATIENTS, EVENTS)
        meds = result["top_medications"]
        assert len(meds) > 0
        codes = [m["medication"] for m in meds]
        assert "Metformina_850mg" in codes

    def test_avg_exam_values(self):
        result = compute_aggregate("diabetes_tipo_2", PATIENTS, EVENTS)
        exams = result["avg_exam_values"]
        hba1c = next((e for e in exams if e["exam_code"] == "HbA1c"), None)
        assert hba1c is not None
        expected_avg = (8.1 + 7.4 + 9.2 + 7.8) / 4
        assert abs(hba1c["avg_value"] - expected_avg) < 0.01
        assert hba1c["unit"] == "%"

    def test_empty_patients(self):
        result = compute_aggregate("diabetes_tipo_2", [], [])
        assert result["total_patients"] == 0

    def test_no_individual_data_exposed(self):
        result = compute_aggregate("diabetes_tipo_2", PATIENTS, EVENTS)
        result_str = json.dumps(result)
        assert "João" not in result_str
        assert "P000001" not in result_str


class TestAggregateToJson:
    def test_valid_json(self):
        stats = compute_aggregate("diabetes_tipo_2", PATIENTS, EVENTS)
        payload = aggregate_to_json(stats)
        parsed = json.loads(payload)
        assert parsed["total_patients"] == 4
