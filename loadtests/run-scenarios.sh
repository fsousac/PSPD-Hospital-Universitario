#!/usr/bin/env bash
# Roda os 5 cenários de usuários simultâneos exigidos pelo enunciado
# (10/50/100/500/1000) contra loadtests/k6-scenario.js, salvando um resumo
# JSON por cenário em loadtests/results/.
#
# Uso (na VM da disciplina, que já tem k6 instalado):
#   ssh -p 10200 <matricula>@kiriland.unb.br
#   ./loadtests/run-scenarios.sh
#
# Variáveis de ambiente do k6-scenario.js (USERNAME, PASSWORD, BASE_URL,
# etc.) podem ser exportadas antes de rodar este script.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DURATION="${DURATION:-1m}"
RESULTS_DIR="$SCRIPT_DIR/results"
mkdir -p "$RESULTS_DIR"

for vus in 10 50 100 500 1000; do
  echo "=== Cenário: ${vus} usuários simultâneos (duração ${DURATION}) ==="
  k6 run \
    --vus "$vus" \
    --duration "$DURATION" \
    --summary-export="$RESULTS_DIR/${vus}-vus.json" \
    "$SCRIPT_DIR/k6-scenario.js"
  echo
done

echo "Resultados salvos em $RESULTS_DIR/. Cruzar com os dashboards do Grafana (CPU/memória) para o relatório."
