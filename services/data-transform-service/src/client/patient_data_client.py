from typing import Any

import grpc

from src.config import PATIENT_DATA_SERVICE_URL
from src.generated import patient_data_pb2 as pb2
from src.generated import patient_data_pb2_grpc as pb2_grpc


def _pb_to_dict_patient(p) -> dict:
    return {
        "patient_id": p.patient_id,
        "full_name": p.full_name,
        "birth_date": p.birth_date,
        "gender": p.gender,
        "city": p.city,
        "state": p.state,
        "cpf": p.cpf,
        "cns": p.cns,
    }


def _pb_to_dict_encounter(e) -> dict:
    return {
        "encounter_id": e.encounter_id,
        "patient_id": e.patient_id,
        "start_date": e.start_date,
        "end_date": e.end_date,
        "type": e.type,
        "department": e.department,
    }


def _pb_to_dict_event(ev) -> dict:
    return {
        "event_id": ev.event_id,
        "patient_id": ev.patient_id,
        "encounter_id": ev.encounter_id,
        "event_type": ev.event_type,
        "event_code": ev.event_code,
        "description": ev.description,
        "event_date": ev.event_date,
        "value": ev.value,
        "unit": ev.unit,
    }


class PatientDataClient:
    def __init__(self, address: str = PATIENT_DATA_SERVICE_URL):
        # round_robin + dns:///: sem isso, o canal (aberto uma vez e
        # reaproveitado por todo o processo) fica pinado no primeiro pod que
        # o resolver DNS devolver — réplicas extras de patient-data-service
        # nunca recebem tráfego deste client. Exige Service headless
        # (clusterIP: None) do lado do patient-data-service (ver k8s/*.yaml).
        self._channel = grpc.aio.insecure_channel(
            "dns:///" + address,
            options=[
                ("grpc.lb_policy_name", "round_robin"),
                # reconsulta DNS mais frequente pra pegar réplicas novas do HPA (ver docs/decisions/0005)
                ("grpc.dns_min_time_between_resolutions_ms", 5000),
            ],
        )
        self._stub = pb2_grpc.PatientDataServiceStub(self._channel)

    async def close(self):
        await self._channel.close()

    async def get_patient(self, patient_id: str) -> dict | None:
        try:
            resp = await self._stub.GetPatient(pb2.GetPatientRequest(patient_id=patient_id))
            return _pb_to_dict_patient(resp)
        except grpc.RpcError as e:
            if e.code() == grpc.StatusCode.NOT_FOUND:
                return None
            raise

    async def list_encounters(self, patient_id: str) -> list[dict]:
        resp = await self._stub.ListEncounters(pb2.ListEncountersRequest(patient_id=patient_id))
        return [_pb_to_dict_encounter(e) for e in resp.encounters]

    async def get_clinical_events(self, patient_id: str, event_type: str = "") -> list[dict]:
        resp = await self._stub.GetClinicalEvents(
            pb2.GetClinicalEventsRequest(patient_id=patient_id, event_type=event_type)
        )
        return [_pb_to_dict_event(ev) for ev in resp.events]

    async def get_patients_by_carer(self, username: str, carer_type: str) -> list[dict]:
        resp = await self._stub.GetPatientsByCarer(
            pb2.GetPatientsByCarerRequest(username=username, carer_type=carer_type)
        )
        return [_pb_to_dict_patient(p) for p in resp.patients]

    async def get_cohort_raw(self, clinical_condition: str) -> tuple[list[dict], list[dict]]:
        resp = await self._stub.GetCohortRaw(
            pb2.GetCohortRawRequest(clinical_condition=clinical_condition)
        )
        patients = [_pb_to_dict_patient(p) for p in resp.patients]
        events = [_pb_to_dict_event(ev) for ev in resp.events]
        return patients, events

    async def get_clinical_summary(self, patient_id: str) -> dict | None:
        try:
            resp = await self._stub.GetClinicalSummary(
                pb2.GetClinicalSummaryRequest(patient_id=patient_id)
            )
            return {
                "patient": _pb_to_dict_patient(resp.patient),
                "recent_encounters": [_pb_to_dict_encounter(e) for e in resp.recent_encounters],
                "diagnoses": [_pb_to_dict_event(ev) for ev in resp.diagnoses],
                "exams": [_pb_to_dict_event(ev) for ev in resp.exams],
                "medications": [_pb_to_dict_event(ev) for ev in resp.medications],
            }
        except grpc.RpcError as e:
            if e.code() == grpc.StatusCode.NOT_FOUND:
                return None
            raise
