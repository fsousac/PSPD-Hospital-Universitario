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
RAMP_UP="${RAMP_UP:-30s}"
NAMESPACE="${NAMESPACE:-grupo-10}"
RESULTS_DIR="$SCRIPT_DIR/results"
mkdir -p "$RESULTS_DIR"

# Antes de cada cenário, espera todos os pods do namespace ficarem X/X Ready.
# Sem isso, um pod recém-escalado pelo HPA (scale-up do cenário anterior
# ainda em andamento, ou cold-start de authorization-service/JVM) fica de
# fora do Service enquanto não fica Ready, e o cenário mede uma réplica
# sobrecarregada sozinha em vez da capacidade real — já reproduzido algumas
# vezes nesta entrega (ver docs/decisions/0005). Silenciosamente pulado se
# `kubectl` não estiver disponível na máquina que roda o k6.
wait_for_cluster_ready() {
  command -v kubectl >/dev/null 2>&1 || return 0
  echo "Aguardando pods do namespace $NAMESPACE ficarem prontos..."
  for _ in $(seq 1 30); do
    not_ready=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null \
      | awk '{split($2, a, "/"); if (a[1] != a[2]) print}' | wc -l)
    [ "$not_ready" -eq 0 ] && return 0
    sleep 5
  done
  echo "Aviso: nem todos os pods ficaram Ready em 150s — resultado pode refletir cold start, não capacidade real." >&2
}

overall_status=0
for vus in 10 50 100 500 1000; do
  wait_for_cluster_ready
  echo "=== Cenário: ${vus} usuários simultâneos (rampa ${RAMP_UP} + ${DURATION}) ==="
  # k6 sai com código != 0 quando um threshold é cruzado (não é um crash) —
  # sem esse `if`, `set -e` abortaria a suíte inteira no primeiro nível que
  # cruzasse qualquer threshold, e os níveis seguintes (o dado mais
  # importante da fase b) nunca rodariam. Cada cenário roda até o fim
  # independente do resultado dos anteriores; o status geral só é reportado
  # no final (ver `exit` abaixo).
  #
  # -e VUS/-e DURATION (não --vus/--duration do CLI): o script define seu
  # próprio executor `ramping-vus` em options.scenarios, que já controla os
  # VUs internamente — misturar com --vus/--duration do k6 CLI conflita.
  if ! k6 run \
    -e VUS="$vus" \
    -e DURATION="$DURATION" \
    -e RAMP_UP="$RAMP_UP" \
    --summary-export="$RESULTS_DIR/${vus}-vus.json" \
    "$SCRIPT_DIR/k6-scenario.js"; then
    echo "Aviso: threshold(s) cruzado(s) no cenário de ${vus} VUs — resultado salvo, seguindo para o próximo nível." >&2
    overall_status=1
  fi
  echo
done

echo "Resultados salvos em $RESULTS_DIR/. Cruzar com os dashboards do Grafana (CPU/memória) para o relatório."
exit "$overall_status"
