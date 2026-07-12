# Testes de carga (k6)

Cobre a fase (b) da metodologia: 10, 50, 100, 500 e 1000 usuários simultâneos,
medindo throughput, latência e taxa de erro via k6, e CPU/memória via Grafana.

## Pré-requisitos

- k6 instalado (já disponível na VM da disciplina):
  ```
  ssh -p 10200 <matricula>@kiriland.unb.br
  ```
- Aplicação implantada no cluster e acessível em
  `https://kiriland.unb.br/grupo10/api/v1/...` (ver `k8s/`).
- Um usuário de teste válido no realm `grupo10` do Keycloak (ver tabela em
  `orientacoes_sobre_clusterK8S.pdf` — ex. `med.cardoso` / `PseudoPEP2026!`).
- Nada além disso: o script já faz login sozinho via client público
  `admin-cli` (confirmado que aceita password grant sem segredo nesse realm).

## Antes de rodar (fases c/d da metodologia)

O `hpa.yaml` (`../k8s/hpa.yaml`) fica fora do `kustomization.yaml` de
propósito — só deve ser aplicado (`kubectl apply -f ../k8s/hpa.yaml`) na
fase (d) de autoscaling. Rodar os testes de carga com HPA já aplicado
durante a fase (c) (escalabilidade horizontal manual via `kubectl scale`)
invalida a comparação, porque o HPA reverte a réplica manual. Ver `../k8s/README.md`.

Os 3 microsserviços de backend usam Service headless + `round_robin` do
lado do cliente gRPC — sem isso, réplicas extras (manuais ou via HPA) não
recebem tráfego e o teste de carga colapsa mesmo com CPU/DB saudáveis (foi a
causa raiz de um colapso real em 50 VUs, ver "gRPC pinado numa única
réplica" em `../docs/decisions/0005-k8s-observability-design.md`).

## Rodando

```bash
cd loadtests
./run-scenarios.sh
```

Isso roda os 5 cenários em sequência e salva um resumo JSON por cenário em
`loadtests/results/`. Antes de cada cenário, o script espera (até 150s) todos
os pods do namespace (`grupo-10` por padrão, `NAMESPACE=` para mudar) ficarem
`Ready` — se `kubectl` estiver disponível na máquina que roda o k6; senão o
passo é pulado silenciosamente. Evita medir uma réplica sobrecarregada
sozinha enquanto o HPA ainda está subindo uma réplica nova (cold start),
padrão de falso-negativo já visto nesta entrega (ver
`../docs/decisions/0005-k8s-observability-design.md`). Para um cenário avulso:

```bash
k6 run --vus 100 --duration 2m k6-scenario.js
```

Para reaproveitar um token já emitido (deve ser o `id_token`, não o
`access_token` — ver comentário em `k6-scenario.js`):

```bash
k6 run --vus 100 --duration 2m -e ACCESS_TOKEN="$ID_TOKEN" k6-scenario.js
```

Perfil pesquisador (endpoint `/api/v1/research/aggregate`):

```bash
k6 run --vus 100 --duration 2m \
  -e USERNAME=pes.mendes -e CONDITION=diabetes_tipo_2 -e PROJECT=PRJ-G10-01 \
  k6-scenario.js
```

## O que o k6 mede vs. o que vem do Grafana

- **k6** (saída do próprio comando / `results/*.json`): throughput
  (`http_reqs`), latência (`http_req_duration`, incluindo p95 via
  threshold), taxa de erro (`http_req_failed`).
- **Grafana** (`https://grafana.kiriland.unb.br`, conta `admgrp10`): uso de
  CPU/memória dos pods durante a janela do teste — abrir o dashboard
  correspondente (`observability/dashboards/`) e observar/capturar
  print/screenshot enquanto o `run-scenarios.sh` está rodando, para compor o
  relatório da disciplina (fora do escopo deste repositório).

## Troubleshooting

Se `setup()` falhar no login (`Falha no login`) com o `CLIENT_ID` default
(`admin-cli`), o mais provável é usuário/senha errados — confirme contra a
tabela de usuários do enunciado. `authorization-service`/`account-console` só
funcionam com `CLIENT_ID` explícito se o professor fornecer o client secret
(`authorization-service` é confidencial) ou habilitar Direct Access Grants
(`account-console`) — ver docs/decisions/0005-k8s-observability-design.md.
