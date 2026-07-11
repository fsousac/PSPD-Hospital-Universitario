#!/usr/bin/env bash
# Gera os stubs gRPC em Go a partir dos .proto na raiz do repositório.
# Pré-requisitos: protoc no PATH e Go 1.22+. Plugins Go instalados abaixo.
#
# Uso (dentro de services/api-gateway/):
#   ./scripts/generate_protos.sh
set -euo pipefail

MODULE="github.com/rabelzx/hu-gateway"
PROTO_DIR="../../proto"

echo "Instalando plugins protoc-gen-go / protoc-gen-go-grpc ..."
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
export PATH="$(go env GOPATH)/bin:$PATH"

echo "Gerando stubs em internal/pb/ ..."
protoc \
  --proto_path="$PROTO_DIR" \
  --go_out=. --go_opt=module="$MODULE" \
  --go-grpc_out=. --go-grpc_opt=module="$MODULE" \
  --go_opt=Mauthorization.proto="$MODULE/internal/pb/authpb" \
  --go-grpc_opt=Mauthorization.proto="$MODULE/internal/pb/authpb" \
  --go_opt=Mpatient_data.proto="$MODULE/internal/pb/patientpb" \
  --go-grpc_opt=Mpatient_data.proto="$MODULE/internal/pb/patientpb" \
  --go_opt=Mdata_transform.proto="$MODULE/internal/pb/transformpb" \
  --go-grpc_opt=Mdata_transform.proto="$MODULE/internal/pb/transformpb" \
  authorization.proto patient_data.proto data_transform.proto

echo "OK. Stubs gerados em internal/pb/{authpb,patientpb,transformpb}/"
