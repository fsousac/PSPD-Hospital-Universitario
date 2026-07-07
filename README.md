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
  ├── Patient Data Service   (PostgreSQL)                            ← stack a definir
  └── Data Transform Service (anonimização + HL7/FHIR)              ← stack a definir
```

### Decisões de stack em aberto

| Componente            | Status              | Local de decisão                          |
|-----------------------|---------------------|-------------------------------------------|
| Frontend              | **a definir**       | [docs/decisions/](docs/decisions/)        |
| API Gateway           | **a definir**       | [docs/decisions/](docs/decisions/)        |
| Patient Data Service  | **a definir**       | [docs/decisions/](docs/decisions/)        |
| Data Transform Service| **a definir**       | [docs/decisions/](docs/decisions/)        |

Registrar cada ADR em `docs/decisions/` seguindo o template ADR (contexto, decisão,
consequências) antes de começar a implementação do serviço.

---

## Authorization Service (único pronto)

Stack fechada: **Java 21 + Quarkus 3 + Keycloak/OAuth2/OIDC**

Responsabilidade: recebe JWT do Keycloak + identificador de recurso, decide
`ALLOW/DENY` e retorna nível de acesso (`FULL | PARTIAL | ANONYMIZED | AGGREGATED`)
validando vínculo do usuário com paciente ou projeto de pesquisa.

```bash
# subir localmente (Docker Compose — apenas Keycloak + PostgreSQL + auth-service)
docker compose up -d

# provisionar realm "hu" + usuários de teste no Keycloak (idempotente)
./scripts/setup-keycloak.sh

# verificar saúde
curl http://localhost:8080/q/health
```

---

## Estrutura de pastas

```
.
├── docs/            # relatório, diagramas e ADRs de decisão de stack
├── proto/           # definições gRPC (authorization.proto completo; demais como esqueleto)
├── frontend/        # stack a definir
├── services/
│   ├── api-gateway/             # stack a definir
│   ├── authorization-service/
│   ├── patient-data-service/    # stack a definir + PostgreSQL
│   └── data-transform-service/  # stack a definir
├── db/              # migrations SQL — só as 2 tabelas do authorization-service por ora;
│                    # patients/encounters/clinical_events ficam a cargo do patient-data-service
├── scripts/         # setup-keycloak.sh — provisiona realm/roles/client/usuários de teste
├── k8s/             # manifests Kubernetes (base, keycloak, postgres, monitoring, services)
├── infra/           # kubeadm e scripts de provisionamento
└── observability/   # dashboards Grafana
```

---

## Pré-requisitos

- Java 21 (authorization-service usa Gradle Wrapper — não precisa de Maven/Gradle instalado à parte, ver [ADR 0001](docs/decisions/0001-authorization-service-technical-decisions.md))
- Docker + Docker Compose
- kubectl configurado para o cluster kubeadm
