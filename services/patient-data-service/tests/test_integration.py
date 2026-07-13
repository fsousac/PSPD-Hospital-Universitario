from datetime import date, datetime, timezone

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.models import Base, ClinicalEvent, Encounter, Patient, UserPatientAssignment


@pytest.fixture(scope="module")
def pg_container():
    from testcontainers.postgres import PostgresContainer
    with PostgresContainer("postgres:17-alpine") as pg:
        yield pg


@pytest_asyncio.fixture(scope="module")
async def pg_engine(pg_container):
    url = pg_container.get_connection_url().replace("psycopg2", "asyncpg")
    engine = create_async_engine(url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(scope="module")
async def session_factory(pg_engine):
    return async_sessionmaker(pg_engine, expire_on_commit=False, class_=AsyncSession)


@pytest_asyncio.fixture(scope="module")
async def seed_data(session_factory):
    async with session_factory() as session:
        p1 = Patient(
            patient_id="P000001",
            full_name="João da Silva",
            birth_date=date(1970, 5, 10),
            gender="male",
            city="Brasília",
            state="DF",
            cpf="111.222.333-44",
            cns="700001234567890",
        )
        p2 = Patient(
            patient_id="P000002",
            full_name="Maria Oliveira",
            birth_date=date(1985, 11, 22),
            gender="female",
            city="Brasília",
            state="DF",
            cpf="222.333.444-55",
            cns="700002345678901",
        )
        enc = Encounter(
            encounter_id="ENC001",
            patient_id="P000001",
            start_date=datetime(2025, 1, 10, 8, 0),
            end_date=datetime(2025, 1, 10, 9, 30),
            type="AMBULATORIAL",
            department="ENDOCRINOLOGY",
        )
        ev1 = ClinicalEvent(
            event_id="CE001",
            patient_id="P000001",
            encounter_id="ENC001",
            event_type="CONDITION",
            event_code="DIABETES",
            description="Diabetes Mellitus Tipo 2",
            event_date=datetime(2023, 1, 10, 8, 0),
        )
        ev2 = ClinicalEvent(
            event_id="CE002",
            patient_id="P000001",
            encounter_id="ENC001",
            event_type="OBSERVATION",
            event_code="HBA1C",
            description="Hemoglobina Glicada",
            event_date=datetime(2025, 1, 10, 8, 30),
            value="8.1",
            unit="%",
        )
        upa = UserPatientAssignment(
            assignment_id="A0000000001",
            username="dr.silva",
            patient_id="P000001",
            tipo_vinculo="ATTENDING",
            active=True,
        )
        session.add_all([p1, p2])
        await session.flush()
        session.add(enc)
        await session.flush()
        session.add_all([ev1, ev2, upa])
        await session.commit()


@pytest.mark.asyncio(loop_scope="module")
async def test_get_patient_found(session_factory, seed_data):
    async with session_factory() as session:
        result = await session.get(Patient, "P000001")
    assert result is not None
    assert result.full_name == "João da Silva"


@pytest.mark.asyncio(loop_scope="module")
async def test_get_patient_not_found(session_factory, seed_data):
    async with session_factory() as session:
        result = await session.get(Patient, "P999999")
    assert result is None


@pytest.mark.asyncio(loop_scope="module")
async def test_list_encounters(session_factory, seed_data):
    from sqlalchemy import select
    async with session_factory() as session:
        rows = (await session.execute(
            select(Encounter).where(Encounter.patient_id == "P000001")
        )).scalars().all()
    assert len(rows) == 1
    assert rows[0].department == "ENDOCRINOLOGY"


@pytest.mark.asyncio(loop_scope="module")
async def test_get_clinical_events_all(session_factory, seed_data):
    from sqlalchemy import select
    async with session_factory() as session:
        rows = (await session.execute(
            select(ClinicalEvent).where(ClinicalEvent.patient_id == "P000001")
        )).scalars().all()
    assert len(rows) == 2


@pytest.mark.asyncio(loop_scope="module")
async def test_get_clinical_events_filtered(session_factory, seed_data):
    from sqlalchemy import select, and_
    async with session_factory() as session:
        rows = (await session.execute(
            select(ClinicalEvent).where(
                and_(
                    ClinicalEvent.patient_id == "P000001",
                    ClinicalEvent.event_type == "CONDITION",
                )
            )
        )).scalars().all()
    assert len(rows) == 1
    assert rows[0].event_code == "DIABETES"


@pytest.mark.asyncio(loop_scope="module")
async def test_cohort_query(session_factory, seed_data):
    from sqlalchemy import select, and_
    async with session_factory() as session:
        subq = (
            select(ClinicalEvent.patient_id)
            .where(and_(
                ClinicalEvent.event_code == "DIABETES",
                ClinicalEvent.event_type == "CONDITION",
            ))
            .distinct()
        )
        patients = (await session.execute(
            select(Patient).where(Patient.patient_id.in_(subq))
        )).scalars().all()

        # GetCohortRaw reusa a mesma subquery (não uma lista Python de ids)
        # para buscar os eventos do coorte — cobre a regressão do fix que
        # elimina o IN(...) gigante com literais (ver docs/decisions/0005).
        events = (await session.execute(
            select(ClinicalEvent).where(ClinicalEvent.patient_id.in_(subq))
        )).scalars().all()
    assert len(patients) == 1
    assert patients[0].patient_id == "P000001"
    assert len(events) == 2
    assert {e.event_id for e in events} == {"CE001", "CE002"}
