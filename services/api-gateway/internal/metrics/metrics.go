// Package metrics declara os coletores Prometheus expostos pelo gateway em
// /metrics. São a fonte das métricas exigidas na fase de Observabilidade do
// projeto (requisições/s, latência, taxa de erro, chamadas ao backend etc.).
package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// Total de requisições HTTP recebidas do frontend, por rota/método/status.
	HTTPRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "gateway_http_requests_total",
			Help: "Total de requisições HTTP atendidas pelo gateway.",
		},
		[]string{"method", "route", "status"},
	)

	// Latência das requisições HTTP (histograma) — base para p50/p95/p99.
	HTTPRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "gateway_http_request_duration_seconds",
			Help:    "Latência das requisições HTTP atendidas pelo gateway.",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "route"},
	)

	// Requisições em voo — mede saturação sob carga.
	HTTPInflight = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "gateway_http_inflight_requests",
			Help: "Número de requisições HTTP sendo processadas neste instante.",
		},
	)

	// Chamadas gRPC feitas aos microsserviços internos, por serviço/método/código.
	UpstreamRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "gateway_upstream_requests_total",
			Help: "Total de chamadas gRPC do gateway aos serviços internos.",
		},
		[]string{"service", "method", "code"},
	)

	// Latência das chamadas gRPC aos microsserviços internos.
	UpstreamRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "gateway_upstream_request_duration_seconds",
			Help:    "Latência das chamadas gRPC do gateway aos serviços internos.",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"service", "method"},
	)

	// Requisições rejeitadas pelo rate limiter (HTTP 429).
	RateLimitRejections = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "gateway_rate_limit_rejections_total",
			Help: "Total de requisições rejeitadas pelo rate limiter.",
		},
	)
)
