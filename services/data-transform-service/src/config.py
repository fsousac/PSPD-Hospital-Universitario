import os

PATIENT_DATA_SERVICE_URL: str = os.getenv(
    "PATIENT_DATA_SERVICE_URL",
    "localhost:50052",
)
GRPC_PORT: int = int(os.getenv("GRPC_PORT", "50053"))
HEALTH_PORT: int = int(os.getenv("HEALTH_PORT", "8083"))
# 100, não 10: agora é aplicado de verdade em main.py, e este serviço atende
# GET /api/v1/patients/{id} (endpoint já testado até 50 VUs).
GRPC_MAX_WORKERS: int = int(os.getenv("GRPC_MAX_WORKERS", "100"))
