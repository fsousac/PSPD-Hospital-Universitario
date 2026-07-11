// Package middleware reúne os middlewares HTTP do gateway: métricas Prometheus,
// autenticação JWT na borda, rate limiting e logging estruturado.
package middleware

import (
	"context"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"golang.org/x/time/rate"

	"github.com/rabelzx/hu-gateway/internal/auth"
	"github.com/rabelzx/hu-gateway/internal/metrics"
)

type ctxKey int

const claimsKey ctxKey = iota

// ClaimsFrom recupera as claims do usuário autenticado do contexto da requisição.
func ClaimsFrom(ctx context.Context) (*auth.Claims, bool) {
	c, ok := ctx.Value(claimsKey).(*auth.Claims)
	return c, ok
}

// statusRecorder captura o status HTTP escrito pelo handler.
type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

// Metrics registra contadores/histogramas Prometheus por requisição. Usa o
// padrão de rota do chi (ex.: /api/v1/patients/{id}) como label, evitando
// explosão de cardinalidade por causa dos IDs.
func Metrics(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		metrics.HTTPInflight.Inc()
		defer metrics.HTTPInflight.Dec()

		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)

		route := chi.RouteContext(r.Context()).RoutePattern()
		if route == "" {
			route = "unknown"
		}
		metrics.HTTPRequestsTotal.WithLabelValues(r.Method, route, strconv.Itoa(rec.status)).Inc()
		metrics.HTTPRequestDuration.WithLabelValues(r.Method, route).Observe(time.Since(start).Seconds())
	})
}

// Logger emite um log estruturado por requisição.
func Logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		slog.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", rec.status,
			"duration_ms", time.Since(start).Milliseconds(),
			"remote", r.RemoteAddr,
		)
	})
}

// RateLimiter aplica um token bucket global. Sob carga alta, protege o backend
// devolvendo 429 em vez de derrubar os serviços internos.
func RateLimiter(rps float64, burst int) func(http.Handler) http.Handler {
	limiter := rate.NewLimiter(rate.Limit(rps), burst)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !limiter.Allow() {
				metrics.RateLimitRejections.Inc()
				WriteError(w, http.StatusTooManyRequests, "rate limit excedido")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// Authn verifica o JWT (Authorization: Bearer <token>) e injeta as claims no
// contexto. Rejeita com 401 quando o token está ausente ou é inválido.
func Authn(verifier *auth.Verifier) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := bearerToken(r)
			if token == "" {
				WriteError(w, http.StatusUnauthorized, "cabeçalho Authorization ausente ou malformado")
				return
			}
			claims, err := verifier.Verify(r.Context(), token)
			if err != nil {
				slog.Warn("jwt rejeitado", "err", err.Error())
				WriteError(w, http.StatusUnauthorized, "token inválido ou expirado")
				return
			}
			ctx := context.WithValue(r.Context(), claimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func bearerToken(r *http.Request) string {
	h := r.Header.Get("Authorization")
	const prefix = "Bearer "
	if len(h) > len(prefix) && strings.EqualFold(h[:len(prefix)], prefix) {
		return strings.TrimSpace(h[len(prefix):])
	}
	return ""
}

// WriteError escreve um erro JSON padronizado; compartilhado com o pacote
// gateway para manter um único formato de erro em toda a API.
func WriteError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(`{"error":` + strconv.Quote(msg) + `}`))
}
