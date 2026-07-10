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

// Router monta o mux HTTP com a cadeia de middlewares e as rotas.
//
// Ordem dos middlewares (de fora para dentro):
//
//	RequestID → Recoverer → Metrics → Logger → RateLimiter → [Authn] → handler
//
// /healthz e /metrics ficam FORA da autenticação para o K8S e o Prometheus os
// alcançarem sem token.
func Router(cfg config.Config, g *Gateway, verifier *auth.Verifier) http.Handler {
	r := chi.NewRouter()

	r.Use(chimw.RequestID)
	r.Use(chimw.Recoverer)
	r.Use(middleware.Metrics)
	r.Use(middleware.Logger)
	r.Use(middleware.RateLimiter(cfg.RateLimitRPS, cfg.RateLimitBurst))

	// Endpoints operacionais (sem autenticação).
	r.Get("/healthz", g.Healthz)
	r.Get("/readyz", g.Healthz)
	r.Handle("/metrics", promhttp.Handler())

	// API de negócio (exige JWT válido).
	r.Group(func(pr chi.Router) {
		pr.Use(middleware.Authn(verifier))

		pr.Get("/api/v1/patients/{id}", g.GetPatient)
		pr.Get("/api/v1/me/patients", g.ListMyPatients)
		pr.Get("/api/v1/research/aggregate", g.AggregateResearch)
	})

	return r
}
