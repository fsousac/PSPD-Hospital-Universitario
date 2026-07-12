# hu-observability

Microsserviços simulando acesso a prontuários eletrônicos (HL7/FHIR) de um Hospital
Universitário, com autenticação Keycloak/OAuth2, controle de acesso por perfil e
observabilidade via Prometheus + Grafana, implantado no cluster Kubernetes
(kubeadm, 4 nós) compartilhado entre os 10 grupos da disciplina — provisionado
e mantido pelo professor, cada grupo com namespace próprio (`grupo-10` neste
caso). Ver `docs/decisions/0005-k8s-observability-design.md` para o histórico
completo de decisões e execução das 5 fases da metodologia (validação
funcional, testes de carga, escalabilidade horizontal, autoscaling e
observabilidade).

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
| Frontend               | **pronto**    | React + Vite + React Router + keycloak-js + MUI | [ADR 0004-frontend](docs/decisions/0004-frontend-technical-decisions.md) |
| API Gateway            | **pronto**    | Go 1.22 + chi + grpc-go + go-oidc + Prometheus  | [ADR 0004](docs/decisions/0004-api-gateway-technical-decisions.md) |
| Authorization Service  | **pronto**    | Java 21 + Quarkus 3 + Keycloak/OAuth2/OIDC      | [ADR 0001](docs/decisions/0001-authorization-service-technical-decisions.md) |
| Patient Data Service   | **pronto**    | Python 3 + gRPC + SQLAlchemy async + PostgreSQL | [ADR 0002](docs/decisions/0002-patient-data-service-technical-decisions.md) |
| Data Transform Service | **pronto**    | Python 3 + gRPC + fhir.resources + Prometheus   | [ADR 0003](docs/decisions/0003-data-transform-service-technical-decisions.md) |

---

## Pré-requisitos

- Docker + Docker Compose
- Java 21 (Authorization Service — usa Gradle Wrapper, não precisa instalar Gradle)
- Python 3.10+ (Patient Data Service e Data Transform Service)
- kubectl + `kubeconfig-grupo-10.kubeconfig` (fornecido pelo professor, dá acesso apenas ao namespace `grupo-10` do cluster kubeadm compartilhado)

---

## API Gateway

Stack: **Go 1.22 + chi + grpc-go + go-oidc + Prometheus**

Ponto de entrada único: recebe REST/JSON do frontend, valida o JWT do Keycloak na
borda, encaminha aos serviços internos via gRPC e consolida as respostas. Aplica
rate limiting, logging e expõe `/metrics`.

| Método | Rota | Perfil |
|--------|------|--------|
| `GET` | `/api/v1/patients/{id}` | médico / estagiário |
| `GET` | `/api/v1/me/patients` | médico / estagiário |
| `GET` | `/api/v1/research/aggregate?condition=&project=` | pesquisador |
| `GET` | `/healthz`, `/metrics` | — |

```powershell
# dentro de services/api-gateway/ (requer Go 1.22+ e protoc no PATH)
.\scripts\generate_protos.ps1
go mod tidy
go run ./cmd/gateway
```

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `GATEWAY_LISTEN_ADDR` | `:8000` | Porta HTTP do gateway |
| `AUTH_SERVICE_ADDR` | `localhost:8080` | gRPC do Authorization Service |
| `PATIENT_DATA_SERVICE_ADDR` | `localhost:50052` | gRPC do Patient Data Service |
| `DATA_TRANSFORM_SERVICE_ADDR` | `localhost:50053` | gRPC do Data Transform Service |
| `OIDC_ISSUER_URL` | `http://localhost:8180/realms/hu` | Realm do Keycloak |

Ver [ADR 0004](docs/decisions/0004-api-gateway-technical-decisions.md) para decisões técnicas.

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

## Deploy no cluster K8S (grupo 10) e observabilidade

Manifests Kubernetes (`k8s/`), scripts de teste de carga k6 (`loadtests/`) e
dashboards Grafana (`observability/dashboards/`) para o cluster K8S (kubeadm,
4 nós) compartilhado da disciplina — provisionado e mantido pelo professor,
não pelo grupo (ver `orientacoes_sobre_clusterK8S.pdf` e
`k8s/README.md`). Cobre as 5 fases da metodologia: validação funcional,
testes de carga (10/50/100/500/1000 VUs), escalabilidade horizontal,
autoscaling (HPA) e observabilidade.

Aplicação exposta em `https://kiriland.unb.br/grupo10` (frontend) e
`https://kiriland.unb.br/grupo10/api/v1/...` (API Gateway), via `Ingress`
próprio do namespace — ver decisão 5 do ADR 0005 (o roteamento Apache
originalmente sugerido pelo professor não funcionou para o grupo 10).

```bash
# assumindo kubeconfig-grupo-10.yaml já obtido (fornecido pelo professor)
export KUBECONFIG=$(pwd)/k8s/kubeconfig-grupo-10.kubeconfig
cp k8s/secrets.env.example k8s/secrets.env   # preencher com a senha real do grupo10
kubectl create secret generic hu-db-credentials -n grupo-10 --from-env-file=k8s/secrets.env
kubectl apply -k k8s/                        # HPA fica fora até a fase de autoscaling
kubectl apply -f k8s/hpa.yaml                # só na fase de autoscaling

cd loadtests && ./run-scenarios.sh           # testes de carga (10/50/100/500/1000 VUs)
```

Os 3 microsserviços de backend usam Service **headless** (`clusterIP: None`)
+ policy `round_robin` no cliente gRPC do api-gateway/data-transform-service
— sem isso, a conexão HTTP/2 persistente de cada cliente fica pinada num
único pod e réplicas extras (manuais ou via HPA) nunca recebem tráfego. Ver
a seção "gRPC pinado numa única réplica" do ADR 0005 para o diagnóstico
completo (causa raiz do colapso em 50 VUs) e o fix.

Ver [ADR 0005](docs/decisions/0005-k8s-observability-design.md) para o
histórico completo de decisões técnicas e o status de execução de cada uma
das 5 fases.

---

## Subindo tudo com Docker Compose

```bash
docker compose up -d --build
./scripts/setup-keycloak.sh
```

---

## Estrutura das pastas

```
.
├── docs/decisions/  # ADRs de decisão técnica por serviço
├── proto/           # definições gRPC (authorization, patient_data, data_transform)
├── frontend/        # React + Vite + React Router + keycloak-js + MUI
├── services/
│   ├── api-gateway/             # Go 1.22 + chi + grpc-go
│   ├── authorization-service/   # Java 21 + Quarkus 3
│   ├── patient-data-service/    # Python 3 + gRPC + PostgreSQL
│   └── data-transform-service/  # Python 3 + gRPC + FHIR R4
├── db/              # migrations SQL — authorization-service + patient-data-service
├── scripts/         # setup-keycloak.sh
├── k8s/             # manifests Kubernetes do namespace grupo-10 (cluster compartilhado)
├── loadtests/       # cenários k6 (fase b da metodologia)
└── observability/   # dashboards Grafana + notas de integração com o Prometheus do cluster
```
