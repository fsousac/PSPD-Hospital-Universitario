# Data Transform Service

Microsserviço responsável pela **anonimização**, **agregação estatística** e **conversão para HL7/FHIR R4** dos dados clínicos do Hospital Universitário.

**Stack:** Python 3.12 · grpcio · fhir.resources · prometheus-client

---

## Responsabilidades

1. Consulta o Patient Data Service (via gRPC) para obter dados brutos
2. Aplica o nível de anonimização correto conforme o `AccessLevel` retornado pelo Authorization Service
3. Converte os dados para recursos FHIR R4 e retorna um `Bundle` JSON

## Níveis de acesso

| AccessLevel | Transformação |
|-------------|---------------|
| `FULL` | Sem anonimização — todos os campos |
| `PARTIAL` | Iniciais do nome, remove CPF/CNS, mantém apenas o ano de nascimento |
| `ANONYMIZED` | ID pseudonimizado (SHA-256), remove nome/CPF/CNS/cidade, faixa etária |
| `AGGREGATED` | Apenas estatísticas (total, percentuais, distribuições) — sem registros individuais |

## Mapeamento FHIR

| Tabela PostgreSQL | Recurso FHIR R4 |
|-------------------|-----------------|
| `patients` | `Patient` |
| `encounters` | `Encounter` |
| `clinical_events` (Condição) | `Condition` |
| `clinical_events` (Observação) | `Observation` |
| `clinical_events` (Medicação) | `MedicationRequest` |

## RPCs disponíveis

| RPC | Descrição |
|-----|-----------|
| `TransformToFhir` | Transforma dados de um paciente em FHIR Bundle |
| `AggregateForResearch` | Produz estatísticas agregadas de uma coorte |

## Rodando localmente

```powershell
# 1. Instale dependências
pip install -r requirements.txt

# 2. Gere os stubs gRPC
.\scripts\generate_protos.ps1

# 3. Suba o Patient Data Service primeiro
# (ver services/patient-data-service/README.md)

# 4. Execute
$env:PATIENT_DATA_SERVICE_URL = "localhost:50052"
python -m src.main
```

## Testes

```powershell
pytest tests/ -v
```

## Endpoints HTTP

| Endpoint | Porta | Descrição |
|----------|-------|-----------|
| `/health` | 8083 | Health check |
| `/metrics` | 8083 | Métricas Prometheus |

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `PATIENT_DATA_SERVICE_URL` | `localhost:50052` | Endereço do Patient Data Service |
| `GRPC_PORT` | `50053` | Porta do servidor gRPC |
| `HEALTH_PORT` | `8083` | Porta do servidor HTTP |
| `GRPC_MAX_WORKERS` | `10` | Workers do thread pool gRPC |
