# hu-observability

Microsserviços simulando acesso a prontuários eletrônicos (HL7/FHIR) de um Hospital
Universitário, com autenticação Keycloak/OAuth2, controle de acesso por perfil e
observabilidade via Prometheus + Grafana em cluster Kubernetes real (kubeadm).

Projeto PSPD — UnB/FCTE | Prof. Fernando W. Cruz

---

## Arquitetura

```
Frontend → API Gateway → gRPC/HTTP2 →
  ├── Authorization Service  (Java/Quarkus + Keycloak/OAuth2/OIDC)
  ├── Patient Data Service   (Python 3 + gRPC + PostgreSQL/asyncpg)
  └── Data Transform Service (Python 3 + gRPC + FHIR R4 + anonimização/agregação)
```

### Status dos serviços

| Componente             | Status        | Stack                                           | ADR                                      |
|------------------------|---------------|-------------------------------------------------|------------------------------------------|
| Frontend               | **a definir** | —                                               | —                                        |
| API Gateway            | **a definir** | —                                               | —                                        |
| Authorization Service  | **pronto**    | Java 21 + Quarkus 3 + Keycloak/OAuth2/OIDC      | [ADR 0001](docs/decisions/0001-authorization-service-technical-decisions.md) |
| Patient Data Service   | **pronto**    | Python 3 + gRPC + SQLAlchemy async + PostgreSQL | [ADR 0002](docs/decisions/0002-patient-data-service-technical-decisions.md) |
| Data Transform Service | **pronto**    | Python 3 + gRPC + fhir.resources + Prometheus   | [ADR 0003](docs/decisions/0003-data-transform-service-technical-decisions.md) |

---

## Pré-requisitos

- Docker + Docker Compose
- Java 21 (Authorization Service — usa Gradle Wrapper, não precisa instalar Gradle)
- Python 3.10+ (Patient Data Service e Data Transform Service)
- kubectl configurado para o cluster kubeadm

---

## Authorization Service

Stack: **Java 21 + Quarkus 3 + Keycloak/OAuth2/OIDC**

Responsabilidade: recebe JWT do Keycloak + identificador de recurso, decide
`ALLOW/DENY` e retorna nível de acesso (`FULL | PARTIAL | ANONYMIZED | AGGREGATED`)
validando vínculo do usuário com paciente ou projeto de pesquisa.

```bash
# subir localmente (Docker Compose)
docker compose up -d postgres keycloak

# provisionar realm "hu" + usuários de teste no Keycloak (idempotente)
./scripts/setup-keycloak.sh

# rodar o serviço em modo dev
cd services/authorization-service
./gradlew quarkusDev
```

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `QUARKUS_DATASOURCE_JDBC_URL` | `jdbc:postgresql://postgres:5432/hu_db` | URL JDBC do PostgreSQL |
| `QUARKUS_OIDC_AUTH_SERVER_URL` | `http://keycloak:8180/realms/hu` | Realm Keycloak |

Ver [ADR 0001](docs/decisions/0001-authorization-service-technical-decisions.md) para decisões técnicas.

---

## Patient Data Service

Stack: **Python 3 + gRPC + SQLAlchemy async + asyncpg + PostgreSQL**

Responsabilidade: armazena e serve prontuários clínicos (pacientes, encontros, eventos clínicos).

| RPC | Descrição |
|-----|-----------|
| `GetPatient` | Dados cadastrais de um paciente |
| `ListEncounters` | Atendimentos de um paciente |
| `GetClinicalEvents` | Eventos clínicos (diagnósticos, exames, medicações) |
| `GetPatientsByCarer` | Pacientes vinculados a um médico ou estagiário |
| `GetCohortRaw` | Pacientes e eventos de uma condição clínica |
| `GetClinicalSummary` | Resumo clínico completo de um paciente |

```powershell
# dentro de services/patient-data-service/
docker compose up -d postgres
pip install -r requirements.txt
.\scripts\generate_protos.ps1

$env:DATABASE_URL = "postgresql+asyncpg://hu_user:hu_password@localhost:5433/hu_db"
python -m src.main
```

```powershell
# testes
pytest tests/test_servicer.py -v       # unitários (sem Docker)
pytest tests/test_integration.py -v   # integração (requer Docker)
```

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `DATABASE_URL` | `postgresql+asyncpg://hu_user:hu_password@localhost:5432/hu_db` | Conexão ao banco |
| `GRPC_PORT` | `50052` | Porta gRPC |
| `HEALTH_PORT` | `8082` | Porta HTTP (health + metrics) |

Ver [ADR 0002](docs/decisions/0002-patient-data-service-technical-decisions.md) para decisões técnicas.

---

## Data Transform Service

Stack: **Python 3 + gRPC + fhir.resources + Prometheus**

Responsabilidade: consulta o PDS, aplica anonimização/FHIR R4/agregação conforme o
nível de acesso (`FULL | PARTIAL | ANONYMIZED | AGGREGATED`).

| AccessLevel | Transformação |
|-------------|---------------|
| `FULL` | Sem anonimização — todos os campos |
| `PARTIAL` | Iniciais do nome, remove CPF/CNS |
| `ANONYMIZED` | ID pseudonimizado (SHA-256), faixa etária, sem nome/CPF/CNS/cidade |
| `AGGREGATED` | Apenas estatísticas — sem registros individuais |

| RPC | Descrição |
|-----|-----------|
| `TransformToFhir` | Transforma dados de um paciente em FHIR Bundle |
| `AggregateForResearch` | Produz estatísticas agregadas de uma coorte |

```powershell
# dentro de services/data-transform-service/
# (Patient Data Service deve estar rodando primeiro)
pip install -r requirements.txt
.\scripts\generate_protos.ps1

$env:PATIENT_DATA_SERVICE_URL = "localhost:50052"
python -m src.main
```

```powershell
# testes
pytest tests/ -v
```

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `PATIENT_DATA_SERVICE_URL` | `localhost:50052` | Endereço do Patient Data Service |
| `GRPC_PORT` | `50053` | Porta gRPC |
| `HEALTH_PORT` | `8083` | Porta HTTP (health + metrics) |

Ver [ADR 0003](docs/decisions/0003-data-transform-service-technical-decisions.md) para decisões técnicas.

---

## Subindo tudo com Docker Compose

```bash
docker compose up -d --build
./scripts/setup-keycloak.sh
```

---

## Estrutura de pastas

```
.
├── docs/decisions/  # ADRs de decisão técnica por serviço
├── proto/           # definições gRPC (authorization, patient_data, data_transform)
├── frontend/        # stack a definir
├── services/
│   ├── api-gateway/             # stack a definir
│   ├── authorization-service/   # Java 21 + Quarkus 3
│   ├── patient-data-service/    # Python 3 + gRPC + PostgreSQL
│   └── data-transform-service/  # Python 3 + gRPC + FHIR R4
├── db/              # migrations SQL — authorization-service + patient-data-service
├── scripts/         # setup-keycloak.sh
├── k8s/             # manifests Kubernetes
├── infra/           # kubeadm e scripts de provisionamento
└── observability/   # dashboards Grafana
```
