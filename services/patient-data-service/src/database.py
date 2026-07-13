from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from src.config import DATABASE_URL

# Dimensionamento do pool: HPA escala este serviço até 10 réplicas (k8s/hpa.yaml),
# e o Postgres do cluster é compartilhado por 10 grupos da disciplina com
# max_connections=500 (~50/grupo como orçamento informal). pool_size=5 +
# max_overflow=10 antigos permitiam até 15 conexões/réplica — 150 no pico de
# HPA, sozinho já 3x o orçamento do grupo inteiro. Reduzido para o pico
# observado ao vivo sob carga real (nunca mais que ~9 conexões ativas
# simultâneas com 3 réplicas, ver docs/decisions/0005-k8s-observability-design.md),
# com folga: pool_size=3 + max_overflow=2 = 5/réplica, 50 no teto de 10
# réplicas — ainda o orçamento cheio do grupo nesse teto extremo, mas o
# authorization-service (outro consumidor de conexões do grupo) raramente
# escala ao mesmo tempo que este serviço satura. Ajuste fino pendente de
# validação em carga real de 500+ VUs.
engine = create_async_engine(DATABASE_URL, pool_pre_ping=True, pool_size=3, max_overflow=2)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


@asynccontextmanager
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
