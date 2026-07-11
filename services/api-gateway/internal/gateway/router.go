package gateway

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"github.com/rabelzx/hu-gateway/internal/auth"
	"github.com/rabelzx/hu-gateway/internal/config"
	"github.com/rabelzx/hu-gateway/internal/middleware"
)

// metricsRPS/metricsBurst limitam /metrics a uma taxa generosa — não é um
// valor a ajustar por ambiente (por isso não veio de config.Config), só uma
// rede de proteção contra abuso; nunca deve interferir num scrape normal do
// Prometheus (intervalo típico de 15s).
const metricsRPS, metricsBurst = 50, 100

// Router monta o mux HTTP com a cadeia de middlewares e as rotas.
//
// Ordem dos middlewares (de fora para dentro):
//
//	RequestID → Metrics → Logger → Recoverer → [RateLimiter → Authn] → handler
//
// Recoverer fica por último (mais perto do handler) para que um panic seja
// recuperado ANTES de subir por Logger/Metrics — assim as duas continuam
// registrando status/latência mesmo quando o handler explode; com Recoverer
// por fora, o panic pulava o código pós-chamada de ambas e a requisição
// desaparecia de métricas e logs.
//
// /healthz e /readyz ficam fora da autenticação e do rate limit — precisam
// responder mesmo sob carga, já que é isso que o K8S usa para decidir se o
// pod está saudável. /metrics leva um rate limit próprio, bem mais generoso
// que o do tráfego de negócio, só para não ficar completamente exposto.
func Router(cfg config.Config, g *Gateway, verifier *auth.Verifier) http.Handler {
	r := chi.NewRouter()

	r.Use(chimw.RequestID)
	r.Use(middleware.Metrics)
	r.Use(middleware.Logger)
	r.Use(chimw.Recoverer)

	// Endpoints operacionais (sem autenticação).
	r.Get("/healthz", g.Healthz)
	r.Get("/readyz", g.Readyz)
	r.With(middleware.RateLimiter(metricsRPS, metricsBurst)).Handle("/metrics", promhttp.Handler())

	// API de negócio (exige JWT válido e está sujeita a rate limit).
	r.Group(func(pr chi.Router) {
		pr.Use(middleware.RateLimiter(cfg.RateLimitRPS, cfg.RateLimitBurst))
		pr.Use(middleware.Authn(verifier))

		pr.Get("/api/v1/patients/{id}", g.GetPatient)
		pr.Get("/api/v1/me/patients", g.ListMyPatients)
		pr.Get("/api/v1/research/aggregate", g.AggregateResearch)
	})

	return r
}
