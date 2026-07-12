# api-gateway

Stack: **Go 1.22 + chi (REST) + gRPC (grpc-go) + go-oidc + Prometheus**

Ponto de entrada único do backend. Recebe requisições **REST/JSON** do frontend,
valida o **JWT do Keycloak** na borda, encaminha aos microsserviços via **gRPC** e
**consolida** as respostas. Também aplica rate limiting, logging estruturado e
expõe métricas para o Prometheus.

Ver [ADR 0004](../../docs/decisions/0004-api-gateway-technical-decisions.md) para as decisões técnicas.

---

## Responsabilidades (enunciado PSPD)

1. Receber requisições REST do frontend.
2. Validar tokens JWT (assinatura/expiração/emissor contra o JWKS do Keycloak).
3. Encaminhar as requisições aos serviços internos via gRPC.
4. Consolidar as respostas e devolvê-las ao frontend.

Extras: rate limiting (token bucket), logging estruturado (JSON) e `/metrics`.

---

## Fluxo de uma requisição

```
Frontend ──REST + Bearer JWT──► API Gateway
                                  │ 1. valida o JWT (go-oidc / JWKS do Keycloak)
                                  │ 2. gRPC → Authorization.Authorize(jwt, recurso)
                                  │        ← allowed + access_level (FULL/PARTIAL/…)
                                  │ 3. se ALLOW → gRPC → Data Transform / Patient Data
                                  │        ← dados no nível de acesso correto
                                  │ 4. consolida em JSON
Frontend ◄──────── JSON ─────────┘
```

O `access_level` decidido pelo Authorization Service é repassado ao Data
Transform Service — é isso que garante que estagiário/pesquisador recebam dados
anonimizados/agregados.

---

## Rotas REST

| Método | Rota                                              | Perfil               | Serviços internos                          |
|--------|---------------------------------------------------|----------------------|--------------------------------------------|
| `GET`  | `/api/v1/patients/{id}`                           | médico / estagiário  | Authorize → TransformToFhir                |
| `GET`  | `/api/v1/me/patients`                             | médico / estagiário  | GetPatientsByCarer                         |
| `GET`  | `/api/v1/research/aggregate?condition=&project=`  | pesquisador          | Authorize → AggregateForResearch           |
| `GET`  | `/healthz`, `/readyz`                             | —                    | (liveness/readiness, sem JWT)              |
| `GET`  | `/metrics`                                        | —                    | Prometheus (sem JWT)                       |

Exemplos de IDs no seed (`db/migrations`): pacientes `P000001..P000010`,
projetos `PRJ01` (Aprovado), `PRJ02` (Suspenso), `PRJ03` (expirado).

---

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `GATEWAY_LISTEN_ADDR` | `:8000` | Endereço/porta HTTP do gateway |
| `AUTH_SERVICE_ADDR` | `localhost:8080` | gRPC do Authorization Service |
| `PATIENT_DATA_SERVICE_ADDR` | `localhost:50052` | gRPC do Patient Data Service |
| `DATA_TRANSFORM_SERVICE_ADDR` | `localhost:50053` | gRPC do Data Transform Service |
| `OIDC_ISSUER_URL` | `http://localhost:8180/realms/hu` | Realm do Keycloak (descoberta OIDC) |
| `OIDC_PUBLIC_ISSUER_URL` | *(vazio)* | Issuer público esperado quando a descoberta usa uma URL interna do Docker |
| `OIDC_CLIENT_ID` | *(vazio)* | Audience esperado; vazio = checagem desligada |
| `RATE_LIMIT_RPS` | `500` | Requisições/segundo do token bucket global |
| `RATE_LIMIT_BURST` | `1000` | Rajada permitida |
| `UPSTREAM_TIMEOUT_MS` | `5000` | Timeout das chamadas gRPC internas |

---

## Rodando localmente

Pré-requisitos: **Go 1.22+** e **protoc** no PATH.

```powershell
# dentro de services/api-gateway/
.\scripts\generate_protos.ps1        # gera os stubs gRPC em internal/pb/
go mod tidy
go run ./cmd/gateway
```

```bash
# Linux / WSL
./scripts/generate_protos.sh
go mod tidy
go run ./cmd/gateway
```

Suba antes as dependências (Keycloak + serviços internos):

```bash
docker compose up -d postgres keycloak authorization-service patient-data-service data-transform-service
./scripts/setup-keycloak.sh   # cria realm "hu" + usuários de teste
```

### Testando com um token real

```bash
# obtém um JWT do Keycloak (usuário dr.silva = médico)
TOKEN=$(curl -s -X POST \
  http://localhost:8180/realms/hu/protocol/openid-connect/token \
  -d grant_type=password -d client_id=authorization-service \
  -d username=dr.silva -d password=test1234 | jq -r .access_token)

# médico acessando paciente vinculado (P000001) -> 200 FHIR
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/v1/patients/P000001

# lista de pacientes do médico
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/v1/me/patients
```

---

## Métricas expostas (`/metrics`)

| Métrica | Tipo | Uso |
|---------|------|-----|
| `gateway_http_requests_total{method,route,status}` | counter | throughput e taxa de erro |
| `gateway_http_request_duration_seconds{method,route}` | histogram | latência p50/p95/p99 |
| `gateway_http_inflight_requests` | gauge | saturação sob carga |
| `gateway_upstream_requests_total{service,method,code}` | counter | chamadas gRPC ao backend |
| `gateway_upstream_request_duration_seconds{service,method}` | histogram | latência do backend |
| `gateway_rate_limit_rejections_total` | counter | requisições barradas (429) |

Cobrem as métricas exigidas na fase de Observabilidade (requisições/s, latência,
erros, chamadas ao backend).

---

## Docker

```bash
# a partir da RAIZ do repositório (contexto precisa enxergar ./proto)
docker build -f services/api-gateway/Dockerfile -t hu-api-gateway .
```

O build gera os stubs e produz um binário estático (imagem final distroless).
