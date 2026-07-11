// Package config carrega a configuração do gateway a partir de variáveis de
// ambiente, seguindo a mesma convenção dos demais serviços do repositório
// (12-factor: tudo por env, com defaults sensatos para docker-compose).
package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	// Endereço em que o gateway escuta requisições REST do frontend.
	ListenAddr string

	// Endereços gRPC dos microsserviços internos.
	AuthServiceAddr          string // Authorization Service (Quarkus, gRPC na porta HTTP 8080)
	PatientDataServiceAddr   string // Patient Data Service (gRPC 50052)
	DataTransformServiceAddr string // Data Transform Service (gRPC 50053)

	// OIDC / Keycloak — usado para verificar o JWT na borda do gateway.
	OIDCIssuerURL string // ex.: http://keycloak:8180/realms/hu
	OIDCClientID  string // audience esperado; pode ser vazio (checagem desligada)

	// Rate limiting global (token bucket) — protege o backend em testes de carga.
	RateLimitRPS   float64
	RateLimitBurst int

	// Timeouts das chamadas gRPC aos serviços internos.
	UpstreamTimeout time.Duration
}

func Load() Config {
	return Config{
		ListenAddr:               env("GATEWAY_LISTEN_ADDR", ":8000"),
		AuthServiceAddr:          env("AUTH_SERVICE_ADDR", "localhost:8080"),
		PatientDataServiceAddr:   env("PATIENT_DATA_SERVICE_ADDR", "localhost:50052"),
		DataTransformServiceAddr: env("DATA_TRANSFORM_SERVICE_ADDR", "localhost:50053"),
		OIDCIssuerURL:            env("OIDC_ISSUER_URL", "http://localhost:8180/realms/hu"),
		OIDCClientID:             env("OIDC_CLIENT_ID", ""),
		RateLimitRPS:             envFloat("RATE_LIMIT_RPS", 500),
		RateLimitBurst:           envInt("RATE_LIMIT_BURST", 1000),
		UpstreamTimeout:          time.Duration(envInt("UPSTREAM_TIMEOUT_MS", 5000)) * time.Millisecond,
	}
}

func env(key, def string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return def
}

func envInt(key string, def int) int {
	if v, ok := os.LookupEnv(key); ok {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

func envFloat(key string, def float64) float64 {
	if v, ok := os.LookupEnv(key); ok {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			return f
		}
	}
	return def
}
