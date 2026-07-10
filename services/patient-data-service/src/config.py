import os

DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://hu_user:hu_password@localhost:5433/hu_db",
)
GRPC_PORT: int = int(os.getenv("GRPC_PORT", "50052"))
HEALTH_PORT: int = int(os.getenv("HEALTH_PORT", "8082"))
GRPC_MAX_WORKERS: int = int(os.getenv("GRPC_MAX_WORKERS", "10"))
