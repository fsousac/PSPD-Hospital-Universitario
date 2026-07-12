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
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"google.golang.org/grpc/codes"
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
	claims, ok := middleware.ClaimsFrom(r.Context())
	if !ok {
		middleware.WriteError(w, http.StatusUnauthorized, "não autenticado")
		return
	}
	patientID := chi.URLParam(r, "id")

	decision, err := g.authorize(r.Context(), claims.Raw,
		authpb.ResourceType_PATIENT, patientID, authpb.Action_READ)
	if err != nil {
		writeUpstreamError(w, "authorization-service", err)
		return
	}
	if !decision.GetAllowed() {
		middleware.WriteError(w, http.StatusForbidden, "acesso negado ao paciente")
		return
	}
	accessLevel, ok := toTransformAccessLevel(decision.GetAccessLevel())
	if !ok {
		slog.Error("authorization-service retornou allowed=true com access_level inválido", "patient_id", patientID)
		middleware.WriteError(w, http.StatusInternalServerError, "erro de autorização")
		return
	}

	req := &transformpb.FhirTransformRequest{
		PatientId:     patientID,
		AccessLevel:   accessLevel,
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
	claims, ok := middleware.ClaimsFrom(r.Context())
	if !ok {
		middleware.WriteError(w, http.StatusUnauthorized, "não autenticado")
		return
	}
	role := claims.PrimaryRole()
	if role != "medico" && role != "estagiario" {
		middleware.WriteError(w, http.StatusForbidden, "apenas médicos e estagiários têm lista de pacientes")
		return
	}

	// Paginação: usuários reais do seed de carga têm dezenas de milhares de
	// vínculos — sem limit/offset, a lista inteira estoura timeout/memória
	// (ver docs/decisions/0005). limit/offset ausentes ou inválidos viram 0,
	// e o patient-data-service aplica seu próprio default/teto.
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	req := &patientpb.GetPatientsByCarerRequest{
		Username:  claims.Username,
		CarerType: role,
		Limit:     int32(limit),
		Offset:    int32(offset),
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
		"role":       role,
		"count":      len(out),
		"patients":   out,
		"totalCount": resp.GetTotalCount(),
		"limit":      resp.GetLimit(),
		"offset":     resp.GetOffset(),
	})
}

// AggregateResearch — GET /api/v1/research/aggregate?condition=<cond>&project=<PRJxx>
// Estatísticas agregadas de uma coorte, para pesquisadores. Autorização depende
// de o projeto estar aprovado e vigente (regra no Authorization Service).
func (g *Gateway) AggregateResearch(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFrom(r.Context())
	if !ok {
		middleware.WriteError(w, http.StatusUnauthorized, "não autenticado")
		return
	}
	condition := r.URL.Query().Get("condition")
	projectID := r.URL.Query().Get("project")
	if condition == "" || projectID == "" {
		middleware.WriteError(w, http.StatusBadRequest, "parâmetros 'condition' e 'project' são obrigatórios")
		return
	}

	decision, err := g.authorize(r.Context(), claims.Raw,
		authpb.ResourceType_RESEARCH_PROJECT, projectID, authpb.Action_AGGREGATE)
	if err != nil {
		writeUpstreamError(w, "authorization-service", err)
		return
	}
	if !decision.GetAllowed() {
		middleware.WriteError(w, http.StatusForbidden, "acesso negado ao projeto de pesquisa")
		return
	}
	accessLevel, ok := toTransformAccessLevel(decision.GetAccessLevel())
	if !ok {
		slog.Error("authorization-service retornou allowed=true com access_level inválido", "project_id", projectID)
		middleware.WriteError(w, http.StatusInternalServerError, "erro de autorização")
		return
	}

	req := &transformpb.AggregateRequest{
		ClinicalCondition: condition,
		ProjectId:         projectID,
		AccessLevel:       accessLevel,
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

// Healthz — liveness probe: só confirma que o processo está de pé.
func (g *Gateway) Healthz(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "UP"})
}

// Readyz — readiness probe: só reporta pronto se os três backends gRPC não
// estiverem em falha (ver Clients.Ready), para o K8S não rotear tráfego real
// a um pod cujas dependências ainda não subiram.
func (g *Gateway) Readyz(w http.ResponseWriter, _ *http.Request) {
	if !g.clients.Ready() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "DOWN"})
		return
	}
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

// toTransformAccessLevel converte o AccessLevel decidido pelo Authorization
// Service (authpb) para o tipo esperado pelo Data Transform Service
// (transformpb). São dois enums gerados de protos distintos que hoje têm os
// mesmos valores inteiros — um switch explícito, em vez de cast direto, evita
// que uma futura divergência entre os dois protos vaze silenciosamente um
// nível de acesso errado (ver ADR 0004, item 7).
//
// O segundo retorno é false para qualquer valor não mapeado, inclusive o
// zero-value ACCESS_LEVEL_UNSPECIFIED: se o Authorization Service algum dia
// devolver allowed=true sem um access_level válido, o chamador deve negar o
// acesso (fail-closed) em vez de repassar UNSPECIFIED ao Data Transform
// Service, que trata qualquer nível não reconhecido como "sem anonimização".
func toTransformAccessLevel(a authpb.AccessLevel) (transformpb.AccessLevel, bool) {
	switch a {
	case authpb.AccessLevel_FULL:
		return transformpb.AccessLevel_FULL, true
	case authpb.AccessLevel_PARTIAL:
		return transformpb.AccessLevel_PARTIAL, true
	case authpb.AccessLevel_ANONYMIZED:
		return transformpb.AccessLevel_ANONYMIZED, true
	case authpb.AccessLevel_AGGREGATED:
		return transformpb.AccessLevel_AGGREGATED, true
	default:
		return transformpb.AccessLevel_ACCESS_LEVEL_UNSPECIFIED, false
	}
}

// initials transforma "João da Silva" em "J. S." para o nível PARTIAL,
// ignorando partículas curtas (de/da/do/dos) — mesmo critério usado pelo
// Data Transform Service (anonymizer._initials) para o nível PARTIAL em
// Python, mantendo a anonimização consistente entre os dois serviços.
func initials(name string) string {
	var parts []string
	for _, p := range strings.Fields(name) {
		if len([]rune(p)) > 2 {
			parts = append(parts, p)
		}
	}
	switch len(parts) {
	case 0:
		if name == "" {
			return ""
		}
		return string([]rune(name)[0]) + "."
	case 1:
		return string([]rune(parts[0])[0]) + "."
	default:
		first := string([]rune(parts[0])[0])
		last := string([]rune(parts[len(parts)-1])[0])
		return first + ". " + last + "."
	}
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

// writeUpstreamError traduz erros gRPC dos serviços internos em respostas
// HTTP, preservando o código de erro quando o serviço interno já sinalizou um
// motivo específico (paciente inexistente, argumento inválido, etc.) em vez
// de sempre devolver 502 — código que não distingue "backend fora do ar" de
// "recurso não encontrado". A mensagem enviada ao cliente é sempre genérica
// (fixa por status); o texto original do backend só vai para o log — nunca
// repassamos st.Message() ao chamador, já que um serviço interno pode um dia
// colocar detalhe sensível ali (erro de banco, stack, etc.).
func writeUpstreamError(w http.ResponseWriter, service string, err error) {
	slog.Error("erro no serviço interno", "service", service, "err", err.Error())
	switch status.Code(err) {
	case codes.NotFound:
		middleware.WriteError(w, http.StatusNotFound, "recurso não encontrado")
	case codes.InvalidArgument:
		middleware.WriteError(w, http.StatusBadRequest, "parâmetros inválidos")
	case codes.PermissionDenied:
		middleware.WriteError(w, http.StatusForbidden, "acesso negado")
	case codes.Unauthenticated:
		middleware.WriteError(w, http.StatusUnauthorized, "não autenticado")
	case codes.DeadlineExceeded:
		middleware.WriteError(w, http.StatusGatewayTimeout, "tempo limite ao contatar "+service)
	default:
		middleware.WriteError(w, http.StatusBadGateway, "falha ao contatar "+service)
	}
}
