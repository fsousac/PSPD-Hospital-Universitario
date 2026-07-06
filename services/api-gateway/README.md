# api-gateway

**Stack: a definir pelo grupo**

Responsabilidade: ponto de entrada único para clientes externos. Roteia
requisições HTTP/gRPC para os serviços internos, propaga o JWT do Keycloak
nos headers e aplica rate limiting / TLS termination.

## Rotas esperadas

| Rota                        | Destino                    |
|-----------------------------|----------------------------|
| `POST /auth/authorize`      | authorization-service      |
| `GET  /patients/{id}`       | patient-data-service       |
| `GET  /patients/{id}/fhir`  | data-transform-service     |
| `GET  /research/aggregate`  | data-transform-service     |

## Decisão de stack

Registrar ADR em `docs/decisions/` antes de criar qualquer arquivo de projeto aqui.
Candidatos comuns: Nginx + Lua, Kong, Envoy, Traefik, ou gateway dedicado na linguagem do grupo.
