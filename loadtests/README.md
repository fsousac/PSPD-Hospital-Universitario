# Testes de carga (k6)

Cobre a fase (b) da metodologia: 10, 50, 100, 500 e 1000 usuários simultâneos,
medindo throughput, latência e taxa de erro via k6, e CPU/memória via Grafana.

## Pré-requisitos

- k6 instalado (já disponível na VM da disciplina):
  ```
  ssh -p 10200 <matricula>@kiriland.unb.br
  ```
- Aplicação implantada no cluster e acessível em
  `https://kiriland.unb.br/grupo10` (ver `k8s/`).
- Um usuário de teste válido no realm `grupo10` do Keycloak (ver tabela em
  `orientacoes_sobre_clusterK8S.pdf` — ex. `med.cardoso` / `PseudoPEP2026!`).

## Rodando

```bash
cd loadtests
./run-scenarios.sh
```

Isso roda os 5 cenários em sequência e salva um resumo JSON por cenário em
`loadtests/results/`. Para um cenário avulso:

```bash
k6 run --vus 100 --duration 2m k6-scenario.js
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

Se `setup()` falhar no login (`Falha no login`), o `CLIENT_ID` default
(`authorization-service`) provavelmente não existe/não permite password-grant
no realm `grupo10` — ver a seção "Riscos" de
`docs/decisions/0005-k8s-observability-design.md` para os próximos passos de
investigação (não é algo resolvível só neste script).
