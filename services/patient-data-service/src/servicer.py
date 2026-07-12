import logging
import time

import grpc
from sqlalchemy import select, and_
from prometheus_client import Counter, Histogram

from src.converters import event_to_dict, encounter_to_dict, patient_to_dict
from src.database import get_session
from src.models import ClinicalEvent, Encounter, Patient, UserPatientAssignment
from src.generated import patient_data_pb2 as pb2
from src.generated import patient_data_pb2_grpc as pb2_grpc

logger = logging.getLogger(__name__)

REQUEST_COUNT = Counter(
    "patient_data_grpc_requests_total",
    "Total de requisições gRPC recebidas",
    ["method", "status"],
)
REQUEST_LATENCY = Histogram(
    "patient_data_grpc_latency_seconds",
    "Latência das requisições gRPC",
    ["method"],
)
DB_QUERY_DURATION = Histogram(
    "patient_data_db_query_duration_seconds",
    "Duração das queries ao banco de dados",
    ["query"],
)


def _patient_to_pb(p: Patient) -> pb2.PatientRecord:
    return pb2.PatientRecord(**patient_to_dict(p))


def _encounter_to_pb(e: Encounter) -> pb2.EncounterRecord:
    return pb2.EncounterRecord(**encounter_to_dict(e))


def _event_to_pb(ev: ClinicalEvent) -> pb2.ClinicalEventRecord:
    return pb2.ClinicalEventRecord(**event_to_dict(ev))


class PatientDataServicer(pb2_grpc.PatientDataServiceServicer):

    def _track(self, method: str):
        class _Tracker:
            def __init__(self, m):
                self._m = m
                self._start = None

            def __enter__(self):
                self._start = time.perf_counter()
                return self

            def __exit__(self, exc_type, *_):
                elapsed = time.perf_counter() - self._start
                REQUEST_LATENCY.labels(method=self._m).observe(elapsed)
                status = "error" if exc_type else "ok"
                REQUEST_COUNT.labels(method=self._m, status=status).inc()

        return _Tracker(method)

    async def GetPatient(self, request: pb2.GetPatientRequest, context: grpc.aio.ServicerContext):
        with self._track("GetPatient"):
            async with get_session() as session:
                t0 = time.perf_counter()
                result = await session.get(Patient, request.patient_id)
                DB_QUERY_DURATION.labels(query="get_patient").observe(time.perf_counter() - t0)

            if result is None:
                await context.abort(grpc.StatusCode.NOT_FOUND, f"Paciente {request.patient_id} não encontrado")
                return pb2.PatientRecord()

            return _patient_to_pb(result)

    async def ListEncounters(self, request: pb2.ListEncountersRequest, context: grpc.aio.ServicerContext):
        with self._track("ListEncounters"):
            async with get_session() as session:
                t0 = time.perf_counter()
                rows = (await session.execute(
                    select(Encounter)
                    .where(Encounter.patient_id == request.patient_id)
                    .order_by(Encounter.start_date.desc())
                )).scalars().all()
                DB_QUERY_DURATION.labels(query="list_encounters").observe(time.perf_counter() - t0)

            return pb2.ListEncountersResponse(encounters=[_encounter_to_pb(e) for e in rows])

    async def GetClinicalEvents(self, request: pb2.GetClinicalEventsRequest, context: grpc.aio.ServicerContext):
        with self._track("GetClinicalEvents"):
            async with get_session() as session:
                stmt = (
                    select(ClinicalEvent)
                    .where(ClinicalEvent.patient_id == request.patient_id)
                    .order_by(ClinicalEvent.event_date.desc())
                )
                if request.event_type:
                    stmt = stmt.where(ClinicalEvent.event_type == request.event_type)

                t0 = time.perf_counter()
                rows = (await session.execute(stmt)).scalars().all()
                DB_QUERY_DURATION.labels(query="get_clinical_events").observe(time.perf_counter() - t0)

            return pb2.ListClinicalEventsResponse(events=[_event_to_pb(ev) for ev in rows])

    async def GetPatientsByCarer(self, request: pb2.GetPatientsByCarerRequest, context: grpc.aio.ServicerContext):
        with self._track("GetPatientsByCarer"):
            async with get_session() as session:
                t0 = time.perf_counter()

                # carer_type vem do JWT (papel do Keycloak: "medico"/"estagiario"),
                # diferente do valor da coluna assignment_type no banco
                # ("ATTENDING"/"TRAINEE") — não é o mesmo vocabulário.
                if request.carer_type == "estagiario":
                    supervisor_stmt = (
                        select(UserPatientAssignment.username)
                        .where(
                            and_(
                                UserPatientAssignment.usuario_supervisor == request.username,
                                UserPatientAssignment.tipo_vinculo == "ATTENDING",
                                UserPatientAssignment.active.is_(True),
                            )
                        )
                    )
                    supervisors = (await session.execute(supervisor_stmt)).scalars().all()

                    patient_ids_stmt = (
                        select(UserPatientAssignment.patient_id)
                        .where(
                            and_(
                                UserPatientAssignment.username.in_(supervisors),
                                UserPatientAssignment.tipo_vinculo == "ATTENDING",
                                UserPatientAssignment.active.is_(True),
                                UserPatientAssignment.username == request.username,
                                UserPatientAssignment.tipo_vinculo == "estagiario",
                                UserPatientAssignment.status == "ativo",
                            )
                        )
                    )
                else:
                    patient_ids_stmt = (
                        select(UserPatientAssignment.patient_id)
                        .where(
                            and_(
                                UserPatientAssignment.username == request.username,
                                UserPatientAssignment.tipo_vinculo == "ATTENDING",
                                UserPatientAssignment.active.is_(True),
                            )
                        )
                    )

                patient_ids = (await session.execute(patient_ids_stmt)).scalars().all()
                rows = (await session.execute(
                    select(Patient).where(Patient.patient_id.in_(patient_ids))
                )).scalars().all()
                DB_QUERY_DURATION.labels(query="get_patients_by_carer").observe(time.perf_counter() - t0)

            return pb2.PatientListResponse(patients=[_patient_to_pb(p) for p in rows])

    async def GetCohortRaw(self, request: pb2.GetCohortRawRequest, context: grpc.aio.ServicerContext):
        with self._track("GetCohortRaw"):
            async with get_session() as session:
                t0 = time.perf_counter()

                subq = (
                    select(ClinicalEvent.patient_id)
                    .where(
                        and_(
                            ClinicalEvent.event_code == request.clinical_condition,
                            ClinicalEvent.event_type == "CONDITION",
                        )
                    )
                    .distinct()
                )
                patients = (await session.execute(
                    select(Patient).where(Patient.patient_id.in_(subq))
                )).scalars().all()

                events = (await session.execute(
                    select(ClinicalEvent).where(
                        ClinicalEvent.patient_id.in_([p.patient_id for p in patients])
                    )
                )).scalars().all()

                DB_QUERY_DURATION.labels(query="get_cohort_raw").observe(time.perf_counter() - t0)

            return pb2.CohortRawResponse(
                patients=[_patient_to_pb(p) for p in patients],
                events=[_event_to_pb(ev) for ev in events],
            )

    async def GetClinicalSummary(self, request: pb2.GetClinicalSummaryRequest, context: grpc.aio.ServicerContext):
        with self._track("GetClinicalSummary"):
            async with get_session() as session:
                t0 = time.perf_counter()

                patient = await session.get(Patient, request.patient_id)
                if patient is None:
                    await context.abort(grpc.StatusCode.NOT_FOUND, f"Paciente {request.patient_id} não encontrado")
                    return pb2.ClinicalSummaryRecord()

                encounters = (await session.execute(
                    select(Encounter)
                    .where(Encounter.patient_id == request.patient_id)
                    .order_by(Encounter.start_date.desc())
                    .limit(5)
                )).scalars().all()

                events = (await session.execute(
                    select(ClinicalEvent)
                    .where(ClinicalEvent.patient_id == request.patient_id)
                    .order_by(ClinicalEvent.event_date.desc())
                )).scalars().all()

                DB_QUERY_DURATION.labels(query="get_clinical_summary").observe(time.perf_counter() - t0)

            diagnoses = [_event_to_pb(ev) for ev in events if ev.event_type == "CONDITION"]
            exams = [_event_to_pb(ev) for ev in events if ev.event_type == "OBSERVATION"]
            meds = [_event_to_pb(ev) for ev in events if ev.event_type == "MEDICATION"]

            return pb2.ClinicalSummaryRecord(
                patient=_patient_to_pb(patient),
                recent_encounters=[_encounter_to_pb(e) for e in encounters],
                diagnoses=diagnoses,
                exams=exams,
                medications=meds,
            )
