import pytest

from src.transformers.anonymizer import apply_partial, apply_anonymized, _age_band, _initials, _pseudonym


class TestAgeBand:
    def test_child(self):
        assert _age_band("2015-01-01") == "0-17"

    def test_young_adult(self):
        assert _age_band("1995-01-01") == "18-39"

    def test_middle_age(self):
        assert _age_band("1975-01-01") == "40-59"

    def test_senior(self):
        assert _age_band("1955-01-01") == "60+"

    def test_invalid(self):
        assert _age_band("not-a-date") == "desconhecido"

    def test_empty(self):
        assert _age_band("") == "desconhecido"


class TestInitials:
    def test_full_name(self):
        result = _initials("João da Silva")
        assert result == "J. S."

    def test_single_name(self):
        result = _initials("Ana")
        assert result == "A."

    def test_three_parts(self):
        result = _initials("Carlos Eduardo Ferreira")
        assert result == "C. F."


class TestPseudonym:
    def test_deterministic(self):
        assert _pseudonym("P000001") == _pseudonym("P000001")

    def test_different_ids(self):
        assert _pseudonym("P000001") != _pseudonym("P000002")

    def test_prefix(self):
        assert _pseudonym("P000001").startswith("hash-")


class TestApplyPartial:
    def setup_method(self):
        self.patient = {
            "patient_id": "P000001",
            "full_name": "João da Silva",
            "birth_date": "1970-05-10",
            "gender": "male",
            "city": "Brasília",
            "state": "DF",
            "cpf": "111.222.333-44",
            "cns": "700001234567890",
        }

    def test_removes_cpf(self):
        result = apply_partial(self.patient)
        assert result["cpf"] == ""

    def test_removes_cns(self):
        result = apply_partial(self.patient)
        assert result["cns"] == ""

    def test_initials_name(self):
        result = apply_partial(self.patient)
        assert result["full_name"] == "J. S."

    def test_birth_year_only(self):
        result = apply_partial(self.patient)
        assert result["birth_date"] == "1970"

    def test_keeps_gender(self):
        result = apply_partial(self.patient)
        assert result["gender"] == "male"

    def test_keeps_city(self):
        result = apply_partial(self.patient)
        assert result["city"] == "Brasília"

    def test_keeps_patient_id(self):
        result = apply_partial(self.patient)
        assert result["patient_id"] == "P000001"


class TestApplyAnonymized:
    def setup_method(self):
        self.patient = {
            "patient_id": "P000001",
            "full_name": "João da Silva",
            "birth_date": "1970-05-10",
            "gender": "male",
            "city": "Brasília",
            "state": "DF",
            "cpf": "111.222.333-44",
            "cns": "700001234567890",
        }

    def test_pseudonymized_id(self):
        result = apply_anonymized(self.patient)
        assert result["patient_id"].startswith("hash-")
        assert result["patient_id"] != "P000001"

    def test_removes_name(self):
        result = apply_anonymized(self.patient)
        assert result["full_name"] == ""

    def test_removes_cpf(self):
        result = apply_anonymized(self.patient)
        assert result["cpf"] == ""

    def test_removes_cns(self):
        result = apply_anonymized(self.patient)
        assert result["cns"] == ""

    def test_removes_city(self):
        result = apply_anonymized(self.patient)
        assert result["city"] == ""

    def test_age_band(self):
        result = apply_anonymized(self.patient)
        assert result["birth_date"] in ("0-17", "18-39", "40-59", "60+")

    def test_keeps_state(self):
        result = apply_anonymized(self.patient)
        assert result["state"] == "DF"

    def test_keeps_gender(self):
        result = apply_anonymized(self.patient)
        assert result["gender"] == "male"
