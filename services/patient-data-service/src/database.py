from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from src.config import DATABASE_URL

# pool_size=3+max_overflow=2 (5/réplica): teto de 500 conexões do Postgres
# compartilhado entre 10 grupos, HPA escala até 10 réplicas (ver docs/decisions/0005).
engine = create_async_engine(DATABASE_URL, pool_pre_ping=True, pool_size=3, max_overflow=2)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


@asynccontextmanager
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
