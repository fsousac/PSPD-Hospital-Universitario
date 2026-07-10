#!/usr/bin/env bash
# Gera stubs gRPC Python a partir dos arquivos .proto do repositório.
# Execute a partir da raiz do serviço: bash scripts/generate_protos.sh

set -euo pipefail

PROTO_ROOT="$(git rev-parse --show-toplevel)/proto"
OUT_DIR="src/generated"

mkdir -p "$OUT_DIR"
touch "$OUT_DIR/__init__.py"

python -m grpc_tools.protoc \
  -I "$PROTO_ROOT" \
  --python_out="$OUT_DIR" \
  --grpc_python_out="$OUT_DIR" \
  "$PROTO_ROOT/patient_data.proto"

echo "Stubs gerados em $OUT_DIR"
