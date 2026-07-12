import asyncio
import logging
import time

import grpc
from prometheus_client import Counter, Histogram

from src.client.patient_data_client import PatientDataClient
from src.transformers import anonymizer, fhir_mapper, aggregator
from src.generated import data_transform_pb2 as pb2
from src.generated import data_transform_pb2_grpc as pb2_grpc

logger = logging.getLogger(__name__)

REQUEST_COUNT = Counter(
    "data_transform_grpc_requests_total",
    "Total de requisições gRPC recebidas",
    ["method", "status"],
)
REQUEST_LATENCY = Histogram(
    "data_transform_grpc_latency_seconds",
    "Latência das requisições gRPC",
    ["method"],
)

ACCESS_FULL = 1
ACCESS_PARTIAL = 2
ACCESS_ANONYMIZED = 3
ACCESS_AGGREGATED = 4

ALL_RESOURCE_TYPES = {"Patient", "Encounter", "Condition", "Observation", "MedicationRequest"}


class DataTransformServicer(pb2_grpc.DataTransformServiceServicer):

    def __init__(self):
        self._pds_client = PatientDataClient()

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

    async def TransformToFhir(
        self, request: pb2.FhirTransformRequest, context: grpc.aio.ServicerContext
    ) -> pb2.FhirBundle:
        with self._track("TransformToFhir"):
            access_level = request.access_level
            resource_filter = set(request.resource_types) if request.resource_types else ALL_RESOURCE_TYPES

            if access_level == ACCESS_AGGREGATED:
                await context.abort(
                    grpc.StatusCode.INVALID_ARGUMENT,
                    "Para acesso AGGREGATED use o RPC AggregateForResearch.",
                )
                return pb2.FhirBundle()

            patient = await self._pds_client.get_patient(request.patient_id)
            if patient is None:
                await context.abort(
                    grpc.StatusCode.NOT_FOUND,
                    f"Paciente {request.patient_id} não encontrado",
                )
                return pb2.FhirBundle()

            # Independentes entre si (só dependem de patient_id, já resolvido
            # acima) — paralelo em vez de série corta 1 round-trip da cadeia
            # por requisição, o que pesa sob carga (ver docs/decisions/0005).
            encounters, events = await asyncio.gather(
                self._pds_client.list_encounters(request.patient_id),
                self._pds_client.get_clinical_events(request.patient_id),
            )

            if access_level == ACCESS_PARTIAL:
                patient = anonymizer.apply_partial(patient)
            elif access_level == ACCESS_ANONYMIZED:
                anon_id = anonymizer.apply_anonymized(patient)["patient_id"]
                patient = anonymizer.apply_anonymized(patient)
                encounters = _remap_patient_id(encounters, request.patient_id, anon_id)
                events = _remap_patient_id(events, request.patient_id, anon_id)

            fhir_entries: list[dict] = []

            if "Patient" in resource_filter:
                fhir_entries.append(fhir_mapper.patient_to_fhir(patient))

            if "Encounter" in resource_filter:
                for enc in encounters:
                    fhir_entries.append(fhir_mapper.encounter_to_fhir(enc))

            # Valores reais de event_type são maiúsculos em inglês (CONDITION/
            # OBSERVATION/MEDICATION) — schema confirmado ao vivo contra o
            # Postgres do cluster, não os antigos valores em português.
            event_type_map = {
                "CONDITION": "Condition",
                "OBSERVATION": "Observation",
                "MEDICATION": "MedicationRequest",
            }
            for ev in events:
                fhir_type = event_type_map.get(ev.get("event_type", ""))
                if fhir_type and fhir_type in resource_filter:
                    resource = fhir_mapper.clinical_event_to_fhir(ev)
                    if resource:
                        fhir_entries.append(resource)

            json_payload = fhir_mapper.build_bundle(fhir_entries)
            return pb2.FhirBundle(
                resource_type="Bundle",
                type="searchset",
                total=len(fhir_entries),
                json_payload=json_payload,
            )

    async def AggregateForResearch(
        self, request: pb2.AggregateRequest, context: grpc.aio.ServicerContext
    ) -> pb2.AggregateBundle:
        with self._track("AggregateForResearch"):
            access_level = request.access_level
            if access_level not in (ACCESS_AGGREGATED, ACCESS_ANONYMIZED):
                await context.abort(
                    grpc.StatusCode.PERMISSION_DENIED,
                    "AggregateForResearch requer AccessLevel AGGREGATED ou ANONYMIZED.",
                )
                return pb2.AggregateBundle()

            patients, events = await self._pds_client.get_cohort_raw(request.clinical_condition)

            stats = aggregator.compute_aggregate(request.clinical_condition, patients, events)
            json_payload = aggregator.aggregate_to_json(stats)

            gender = stats.get("gender_distribution", {})
            age = stats.get("age_distribution", {})

            gender_msg = pb2.GenderDistribution(
                male_pct=gender.get("male_pct", 0.0),
                female_pct=gender.get("female_pct", 0.0),
                other_pct=gender.get("other_pct", 0.0),
            )
            age_msg = pb2.AgeDistribution(
                age_18_39_pct=age.get("18-39", 0.0),
                age_40_59_pct=age.get("40-59", 0.0),
                age_60_plus_pct=age.get("60+", 0.0),
            )
            meds = [
                pb2.MedicationFrequency(
                    medication=m["medication"],
                    percentage=m["percentage"],
                )
                for m in stats.get("top_medications", [])
            ]

            return pb2.AggregateBundle(
                clinical_condition=request.clinical_condition,
                total_patients=stats["total_patients"],
                gender_dist=gender_msg,
                age_dist=age_msg,
                medications=meds,
                json_payload=json_payload,
            )


def _remap_patient_id(records: list[dict], original: str, new_id: str) -> list[dict]:
    out = []
    for r in records:
        rec = dict(r)
        if rec.get("patient_id") == original:
            rec["patient_id"] = new_id
        out.append(rec)
    return out
