// Package gateway contém os handlers REST do API Gateway. Cada handler traduz
// uma requisição REST do frontend em uma ou mais chamadas gRPC aos serviços
// internos e consolida a resposta — as quatro responsabilidades do enunciado:
// (i) receber REST, (ii) validar JWT (feito no middleware), (iii) encaminhar
// via gRPC, (iv) consolidar a resposta.
package gateway

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"google.golang.org/grpc/status"

	"github.com/rabelzx/hu-gateway/internal/clients"
	"github.com/rabelzx/hu-gateway/internal/config"
	"github.com/rabelzx/hu-gateway/internal/metrics"
	"github.com/rabelzx/hu-gateway/internal/middleware"
	authpb "github.com/rabelzx/hu-gateway/internal/pb/authpb"
	patientpb "github.com/rabelzx/hu-gateway/internal/pb/patientpb"
	transformpb "github.com/rabelzx/hu-gateway/internal/pb/transformpb"
)

type Gateway struct {
	cfg     config.Config
	clients *clients.Clients
}

func New(cfg config.Config, c *clients.Clients) *Gateway {
	return &Gateway{cfg: cfg, clients: c}
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

// GetPatient — GET /api/v1/patients/{id}
// Médico (FULL) ou estagiário (PARTIAL). Decide acesso no Authorization Service
// e delega a montagem/anonimização FHIR ao Data Transform Service.
func (g *Gateway) GetPatient(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFrom(r.Context())
	patientID := chi.URLParam(r, "id")

	decision, err := g.authorize(r.Context(), claims.Raw,
		authpb.ResourceType_PATIENT, patientID, authpb.Action_READ)
	if err != nil {
		writeUpstreamError(w, "authorization-service", err)
		return
	}
	if !decision.GetAllowed() {
		writeError(w, http.StatusForbidden, "acesso negado ao paciente")
		return
	}

	req := &transformpb.FhirTransformRequest{
		PatientId:     patientID,
		AccessLevel:   transformpb.AccessLevel(decision.GetAccessLevel()),
		ResourceTypes: []string{"Patient", "Encounter", "Condition", "Observation", "MedicationRequest"},
	}
	ctx, cancel := g.upstreamCtx(r.Context())
	defer cancel()

	start := time.Now()
	bundle, err := g.clients.Transform.TransformToFhir(ctx, req)
	recordUpstream("data-transform-service", "TransformToFhir", start, err)
	if err != nil {
		writeUpstreamError(w, "data-transform-service", err)
		return
	}

	writeJSONPayload(w, "application/fhir+json", bundle.GetJsonPayload())
}

// ListMyPatients — GET /api/v1/me/patients
// Lista os pacientes vinculados ao usuário autenticado (médico ou estagiário).
// O escopo é intrínseco: o Patient Data Service só devolve pacientes ligados ao
// username do chamador, então não há decisão por-recurso a tomar aqui.
func (g *Gateway) ListMyPatients(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFrom(r.Context())
	role := claims.PrimaryRole()
	if role != "medico" && role != "estagiario" {
		writeError(w, http.StatusForbidden, "apenas médicos e estagiários têm lista de pacientes")
		return
	}

	req := &patientpb.GetPatientsByCarerRequest{
		Username:  claims.Username,
		CarerType: role,
	}
	ctx, cancel := g.upstreamCtx(r.Context())
	defer cancel()

	start := time.Now()
	resp, err := g.clients.Patient.GetPatientsByCarer(ctx, req)
	recordUpstream("patient-data-service", "GetPatientsByCarer", start, err)
	if err != nil {
		writeUpstreamError(w, "patient-data-service", err)
		return
	}

	// Estagiário enxerga apenas iniciais do nome (PARTIAL); médico enxerga tudo.
	partial := role == "estagiario"
	out := make([]map[string]any, 0, len(resp.GetPatients()))
	for _, p := range resp.GetPatients() {
		item := map[string]any{
			"patient_id": p.GetPatientId(),
			"gender":     p.GetGender(),
			"state":      p.GetState(),
		}
		if partial {
			item["name"] = initials(p.GetFullName())
		} else {
			item["name"] = p.GetFullName()
		}
		out = append(out, item)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"role":     role,
		"count":    len(out),
		"patients": out,
	})
}

// AggregateResearch — GET /api/v1/research/aggregate?condition=<cond>&project=<PRJxx>
// Estatísticas agregadas de uma coorte, para pesquisadores. Autorização depende
// de o projeto estar aprovado e vigente (regra no Authorization Service).
func (g *Gateway) AggregateResearch(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFrom(r.Context())
	condition := r.URL.Query().Get("condition")
	projectID := r.URL.Query().Get("project")
	if condition == "" || projectID == "" {
		writeError(w, http.StatusBadRequest, "parâmetros 'condition' e 'project' são obrigatórios")
		return
	}

	decision, err := g.authorize(r.Context(), claims.Raw,
		authpb.ResourceType_RESEARCH_PROJECT, projectID, authpb.Action_AGGREGATE)
	if err != nil {
		writeUpstreamError(w, "authorization-service", err)
		return
	}
	if !decision.GetAllowed() {
		writeError(w, http.StatusForbidden, "acesso negado ao projeto de pesquisa")
		return
	}

	req := &transformpb.AggregateRequest{
		ClinicalCondition: condition,
		ProjectId:         projectID,
		AccessLevel:       transformpb.AccessLevel(decision.GetAccessLevel()),
	}
	ctx, cancel := g.upstreamCtx(r.Context())
	defer cancel()

	start := time.Now()
	bundle, err := g.clients.Transform.AggregateForResearch(ctx, req)
	recordUpstream("data-transform-service", "AggregateForResearch", start, err)
	if err != nil {
		writeUpstreamError(w, "data-transform-service", err)
		return
	}

	writeJSONPayload(w, "application/json", bundle.GetJsonPayload())
}

// Healthz — liveness probe.
func (g *Gateway) Healthz(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "UP"})
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// authorize chama o Authorization Service e instrumenta a chamada.
func (g *Gateway) authorize(ctx context.Context, jwt string, rt authpb.ResourceType, resourceID string, action authpb.Action) (*authpb.AuthorizeResponse, error) {
	req := &authpb.AuthorizeRequest{
		JwtToken:     jwt,
		ResourceType: rt,
		ResourceId:   resourceID,
		Action:       action,
	}
	cctx, cancel := g.upstreamCtx(ctx)
	defer cancel()

	start := time.Now()
	resp, err := g.clients.Auth.Authorize(cctx, req)
	recordUpstream("authorization-service", "Authorize", start, err)
	return resp, err
}

func (g *Gateway) upstreamCtx(parent context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(parent, g.cfg.UpstreamTimeout)
}

func recordUpstream(service, method string, start time.Time, err error) {
	code := status.Code(err).String()
	metrics.UpstreamRequestsTotal.WithLabelValues(service, method, code).Inc()
	metrics.UpstreamRequestDuration.WithLabelValues(service, method).Observe(time.Since(start).Seconds())
}

// initials transforma "João da Silva" em "J.S." para o nível PARTIAL.
func initials(name string) string {
	out := ""
	prevSpace := true
	for _, ch := range name {
		if ch == ' ' {
			prevSpace = true
			continue
		}
		if prevSpace {
			out += string(ch) + "."
			prevSpace = false
		}
	}
	return out
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

// writeJSONPayload escreve um payload que já é uma string JSON pronta (vinda do
// Data Transform Service), sem reserializar.
func writeJSONPayload(w http.ResponseWriter, contentType, payload string) {
	if payload == "" {
		payload = "{}"
	}
	w.Header().Set("Content-Type", contentType)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(payload))
}

func writeError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(`{"error":` + strconv.Quote(msg) + `}`))
}

// writeUpstreamError traduz erros gRPC dos serviços internos em respostas HTTP.
func writeUpstreamError(w http.ResponseWriter, service string, err error) {
	slog.Error("erro no serviço interno", "service", service, "err", err.Error())
	writeError(w, http.StatusBadGateway, "falha ao contatar "+service)
}
