import os

PATIENT_DATA_SERVICE_URL: str = os.getenv(
    "PATIENT_DATA_SERVICE_URL",
    "localhost:50052",
)
GRPC_PORT: int = int(os.getenv("GRPC_PORT", "50053"))
HEALTH_PORT: int = int(os.getenv("HEALTH_PORT", "8083"))
# Default subido de 10 para 100 (2026-07-13): esta config acabou de passar a
# ser aplicada de verdade em main.py (maximum_concurrent_rpcs) — antes era
# lida mas nunca usada, ou seja, o comportamento efetivo até aqui era sem
# teto nenhum. Este serviço atende TransformToFhir, que é o backend de
# GET /api/v1/patients/{id} (ver services/api-gateway/internal/gateway/gateway.go)
# — um dos dois endpoints exercitados pelos testes de carga k6 que já
# colapsaram em 50 VUs. Um teto de 10/réplica reintroduziria artificialmente
# o mesmo tipo de colapso; 100 dá válvula de overload real (RESOURCE_EXHAUSTED
# em vez de degradar tudo) sem virar o novo gargalo nos níveis de VU já
# testados.
GRPC_MAX_WORKERS: int = int(os.getenv("GRPC_MAX_WORKERS", "100"))
