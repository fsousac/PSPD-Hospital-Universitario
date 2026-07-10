# Patient Data Service

Microsserviço responsável pelas consultas SQL ao banco de dados clínico do Hospital Universitário. Expõe uma interface **gRPC** consumida pelo Data Transform Service.

**Stack:** Python 3.12 · grpcio · SQLAlchemy (async) + asyncpg · prometheus-client

---

## Arquitetura

```
API Gateway
    └── Data Transform Service
            └── [gRPC] Patient Data Service ─── PostgreSQL
```

## RPCs disponíveis

| RPC | Descrição |
|-----|-----------|
| `GetPatient` | Retorna dados cadastrais de um paciente |
| `ListEncounters` | Lista atendimentos de um paciente |
| `GetClinicalEvents` | Lista eventos clínicos (diagnósticos / exames / medicações) |
| `GetPatientsByCarer` | Lista pacientes vinculados a um médico ou estagiário |
| `GetCohortRaw` | Retorna pacientes e eventos de uma condição clínica (pesquisadores) |
| `GetClinicalSummary` | Resumo clínico completo de um paciente |

## Rodando localmente

```powershell
# 1. Suba o PostgreSQL
docker compose up -d postgres

# 2. Instale dependências
pip install -r requirements.txt

# 3. Gere os stubs gRPC
.\scripts\generate_protos.ps1

# 4. Execute
$env:DATABASE_URL = "postgresql+asyncpg://hu_user:hu_password@localhost:5433/hu_db"
python -m src.main
```

## Testes

```powershell
# Unitários (sem Docker)
pytest tests/test_servicer.py -v

# Integração (requer Docker)
pytest tests/test_integration.py -v
```

## Endpoints HTTP

| Endpoint | Porta | Descrição |
|----------|-------|-----------|
| `/health` | 8082 | Health check |
| `/metrics` | 8082 | Métricas Prometheus |

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `DATABASE_URL` | `postgresql+asyncpg://hu_user:hu_password@localhost:5432/hu_db` | URL de conexão ao banco |
| `GRPC_PORT` | `50052` | Porta do servidor gRPC |
| `HEALTH_PORT` | `8082` | Porta do servidor HTTP |
| `GRPC_MAX_WORKERS` | `10` | Workers do thread pool gRPC |
