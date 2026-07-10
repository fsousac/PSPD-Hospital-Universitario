# Gera os stubs gRPC em Go a partir dos .proto na raiz do repositório.
# Pré-requisitos: protoc no PATH (https://github.com/protocolbuffers/protobuf/releases)
#                 e Go 1.22+. Os plugins Go são instalados automaticamente abaixo.
#
# Uso (dentro de services/api-gateway/):
#   .\scripts\generate_protos.ps1

$ErrorActionPreference = "Stop"

$module   = "github.com/rabelzx/hu-gateway"
$protoDir = "../../proto"

Write-Host "Instalando plugins protoc-gen-go / protoc-gen-go-grpc ..."
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

# Garante que os binários instalados (em $(go env GOPATH)\bin) estejam no PATH.
$goBin = Join-Path (go env GOPATH) "bin"
$env:PATH = "$goBin;$env:PATH"

Write-Host "Gerando stubs em internal/pb/ ..."
protoc `
  --proto_path=$protoDir `
  --go_out=. --go_opt=module=$module `
  --go-grpc_out=. --go-grpc_opt=module=$module `
  --go_opt=Mauthorization.proto=$module/internal/pb/authpb `
  --go-grpc_opt=Mauthorization.proto=$module/internal/pb/authpb `
  --go_opt=Mpatient_data.proto=$module/internal/pb/patientpb `
  --go-grpc_opt=Mpatient_data.proto=$module/internal/pb/patientpb `
  --go_opt=Mdata_transform.proto=$module/internal/pb/transformpb `
  --go-grpc_opt=Mdata_transform.proto=$module/internal/pb/transformpb `
  authorization.proto patient_data.proto data_transform.proto

Write-Host "OK. Stubs gerados em internal/pb/{authpb,patientpb,transformpb}/"
