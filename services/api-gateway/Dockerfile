# syntax=docker/dockerfile:1
#
# Build context = RAIZ do repositório (para enxergar ./proto).
#   docker build -f services/api-gateway/Dockerfile -t hu-api-gateway .
#
# ---- Stage 1: build ----
FROM golang:1.22-bookworm AS builder

RUN apt-get update \
 && apt-get install -y --no-install-recommends protobuf-compiler \
 && rm -rf /var/lib/apt/lists/*

RUN go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.34.2 \
 && go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.4.0
ENV PATH="/go/bin:${PATH}"

WORKDIR /src/services/api-gateway

# Copia go.mod primeiro para aproveitar o cache de dependências.
COPY services/api-gateway/go.mod ./
RUN go mod download || true

# Código-fonte do gateway + protos compartilhados da raiz.
COPY services/api-gateway/ ./
COPY proto/ /src/proto/

# Gera os stubs gRPC em internal/pb/{authpb,patientpb,transformpb}/.
ARG MODULE=github.com/rabelzx/hu-gateway
RUN protoc --proto_path=/src/proto \
      --go_out=. --go_opt=module=${MODULE} \
      --go-grpc_out=. --go-grpc_opt=module=${MODULE} \
      --go_opt=Mauthorization.proto=${MODULE}/internal/pb/authpb \
      --go-grpc_opt=Mauthorization.proto=${MODULE}/internal/pb/authpb \
      --go_opt=Mpatient_data.proto=${MODULE}/internal/pb/patientpb \
      --go-grpc_opt=Mpatient_data.proto=${MODULE}/internal/pb/patientpb \
      --go_opt=Mdata_transform.proto=${MODULE}/internal/pb/transformpb \
      --go-grpc_opt=Mdata_transform.proto=${MODULE}/internal/pb/transformpb \
      authorization.proto patient_data.proto data_transform.proto

RUN go mod tidy
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/gateway ./cmd/gateway

# ---- Stage 2: runtime ----
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /out/gateway /gateway
EXPOSE 8000
ENTRYPOINT ["/gateway"]
