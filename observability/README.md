# Observabilidade — Prometheus + Grafana (cluster compartilhado)

Prometheus e Grafana já estão instalados a nível de cluster pelo professor
(ver `orientacoes_sobre_clusterK8S.pdf`, item e) — o grupo não instala nada,
só garante que os próprios pods sejam descobertos e importa os dashboards.

## Como o Prometheus do cluster encontra os pods

O cluster usa Prometheus Operator e o namespace `grupo-10` tem permissão para
criar `ServiceMonitor`. Por isso `k8s/servicemonitors.yaml` é o mecanismo
primário de discovery, com um `ServiceMonitor` por serviço:

```bash
kubectl auth can-i create servicemonitors.monitoring.coreos.com -n grupo-10
kubectl apply -k k8s/
```

Os Deployments em `k8s/` também mantêm annotations de scrape como redundância
barata:

```yaml
prometheus.io/scrape: "true"
prometheus.io/port: "<porta do /metrics ou /q/metrics do serviço>"
prometheus.io/path: "/metrics"   # ou /q/metrics no authorization-service
```

Se depois de implantado os targets não aparecerem como `up`, verificar se o
Prometheus do professor seleciona `ServiceMonitor` por label. Nesse caso pode
ser necessário adicionar o label esperado pelo operador do cluster, algo que
depende da configuração global fora do namespace do grupo.

## Dashboards

Um por serviço + um agregado, todos com pelo menos as métricas mínimas
exigidas (requisições/s, latência, uso de CPU/memória, contagem de pods,
erros HTTP/gRPC):

| Arquivo | Métricas Prometheus usadas |
|---|---|
| `api-gateway-dashboard.json` | `gateway_http_requests_total`, `gateway_http_request_duration_seconds`, `gateway_http_inflight_requests`, `gateway_upstream_requests_total`, `gateway_upstream_request_duration_seconds`, `gateway_rate_limit_rejections_total` |
| `authorization-service-dashboard.json` | `authorization_requests_total`, `authorization_decision_duration_seconds`, `jvm_memory_used_bytes`, `process_cpu_usage` |
| `patient-data-service-dashboard.json` | `patient_data_grpc_requests_total`, `patient_data_grpc_latency_seconds`, `patient_data_db_query_duration_seconds` |
| `data-transform-service-dashboard.json` | `data_transform_grpc_requests_total`, `data_transform_grpc_latency_seconds` |
| `overview-dashboard.json` | `kube_deployment_status_replicas_ready`, `container_cpu_usage_seconds_total`, `container_memory_working_set_bytes`, `gateway_http_requests_total` |

Todas as queries filtram por `namespace="grupo-10"` — ajustar se o namespace
real vier diferente do assumido.

## Importando no Grafana

1. Acessar `https://grafana.kiriland.unb.br`, login `admgrp10` / `123456`.
2. Dashboards → New → Import → colar o conteúdo de cada `.json` desta pasta
   (ou upload do arquivo).
3. Selecionar a datasource Prometheus do cluster quando solicitado.

**Confirmado**: o usuário `admgrp10` recebe `dashboards:write` e
`folders:create` negados — só tem permissão de leitura, não dá pra importar
nenhum dashboard hoje. É limitação de permissão no Grafana compartilhado,
fora do nosso namespace/controle. Reportado ao professor pedindo Editor na
conta `admgrp10` (ou uma pasta do grupo10 com permissão de escrita). Enquanto
isso, os JSONs versionados aqui servem como evidência do dashboard planejado
e podem ser importados assim que a permissão for corrigida.

## Riscos / a confirmar

- `kube_deployment_status_replicas_ready` (dashboard overview) depende de
  `kube-state-metrics` estar instalado no cluster — se o painel vier vazio,
  essa é a causa provável.
- Nomes de série do `authorization-service` (JVM/process) podem variar
  conforme a versão do Micrometer/Quarkus — se os painéis 3/4 desse
  dashboard vierem vazios, checar os nomes reais em `/q/metrics` do pod.
