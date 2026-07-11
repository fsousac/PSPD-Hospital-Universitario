// Command gateway é o ponto de entrada do API Gateway do Hospital Universitário.
//
// Responsabilidades (enunciado PSPD): receber requisições REST do frontend,
// validar o JWT do Keycloak, encaminhar aos microsserviços via gRPC e
// consolidar as respostas — além de rate limiting, logging e exposição de
// métricas para o Prometheus.
package main

import (
	"context"
	"errors"
	"flag"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/rabelzx/hu-gateway/internal/auth"
	"github.com/rabelzx/hu-gateway/internal/clients"
	"github.com/rabelzx/hu-gateway/internal/config"
	"github.com/rabelzx/hu-gateway/internal/gateway"
)

func main() {
	healthCheck := flag.Bool("health-check", false, "faz um GET em /healthz e sai (usado pelo HEALTHCHECK do Docker)")
	flag.Parse()

	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})))

	cfg := config.Load()

	// Modo health-check: a imagem distroless não tem curl/wget, então o próprio
	// binário faz a checagem HTTP e sai com 0 (UP) ou 1 (DOWN).
	if *healthCheck {
		os.Exit(runHealthCheck(cfg.ListenAddr))
	}
	slog.Info("iniciando api-gateway",
		"listen", cfg.ListenAddr,
		"auth", cfg.AuthServiceAddr,
		"patient_data", cfg.PatientDataServiceAddr,
		"data_transform", cfg.DataTransformServiceAddr,
		"oidc_issuer", cfg.OIDCIssuerURL,
	)

	// Verificador OIDC — tenta descobrir o JWKS do Keycloak com retry, já que o
	// Keycloak pode ainda estar subindo quando o gateway inicia.
	verifier, err := newVerifierWithRetry(cfg)
	if err != nil {
		slog.Error("não foi possível inicializar o verificador OIDC", "err", err)
		os.Exit(1)
	}

	grpcClients, err := clients.New(cfg)
	if err != nil {
		slog.Error("falha ao abrir conexões gRPC", "err", err)
		os.Exit(1)
	}
	defer grpcClients.Close()

	gw := gateway.New(cfg, grpcClients)
	handler := gateway.Router(cfg, gw, verifier)

	srv := &http.Server{
		Addr:              cfg.ListenAddr,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	// Shutdown gracioso em SIGINT/SIGTERM.
	go func() {
		slog.Info("api-gateway ouvindo", "addr", cfg.ListenAddr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("servidor HTTP encerrou com erro", "err", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	slog.Info("encerrando api-gateway...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("erro no shutdown", "err", err)
	}
}

// runHealthCheck faz um GET em /healthz no endereço local e devolve o exit code.
func runHealthCheck(listenAddr string) int {
	// listenAddr costuma ser ":8000"; monta a URL local correspondente.
	host := listenAddr
	if strings.HasPrefix(host, ":") {
		host = "127.0.0.1" + host
	}
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get("http://" + host + "/healthz")
	if err != nil {
		return 1
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusOK {
		return 0
	}
	return 1
}

// newVerifierWithRetry tenta a descoberta OIDC algumas vezes antes de desistir,
// tolerando um Keycloak que ainda está inicializando.
func newVerifierWithRetry(cfg config.Config) (*auth.Verifier, error) {
	var lastErr error
	for attempt := 1; attempt <= 10; attempt++ {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		v, err := auth.NewVerifier(ctx, cfg.OIDCIssuerURL, cfg.OIDCClientID)
		cancel()
		if err == nil {
			return v, nil
		}
		lastErr = err
		slog.Warn("descoberta OIDC falhou, tentando de novo", "attempt", attempt, "err", err.Error())
		time.Sleep(3 * time.Second)
	}
	return nil, lastErr
}
