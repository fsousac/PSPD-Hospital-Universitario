import asyncio
import logging

import grpc

from src.config import GRPC_MAX_WORKERS, GRPC_PORT
from src.health import start_health_server
from src.servicer import DataTransformServicer
from src.generated import data_transform_pb2_grpc as pb2_grpc

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


async def serve() -> None:
    server = grpc.aio.server(
        options=[
            ("grpc.max_send_message_length", 64 * 1024 * 1024),
            ("grpc.max_receive_message_length", 64 * 1024 * 1024),
        ]
    )
    pb2_grpc.add_DataTransformServiceServicer_to_server(DataTransformServicer(), server)
    server.add_insecure_port(f"0.0.0.0:{GRPC_PORT}")

    start_health_server()
    logger.info(
        "Data Transform Service iniciando na porta %d (gRPC) e %d (HTTP)",
        GRPC_PORT,
        8083,
    )

    await server.start()

    try:
        await server.wait_for_termination()
    except KeyboardInterrupt:
        logger.info("Encerrando servidor...")
        await server.stop(grace=5)


if __name__ == "__main__":
    asyncio.run(serve())
