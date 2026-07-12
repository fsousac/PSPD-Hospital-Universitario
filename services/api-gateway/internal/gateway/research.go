package gateway

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/rabelzx/hu-gateway/internal/auth"
	"github.com/rabelzx/hu-gateway/internal/middleware"
	authpb "github.com/rabelzx/hu-gateway/internal/pb/authpb"
	patientpb "github.com/rabelzx/hu-gateway/internal/pb/patientpb"
	transformpb "github.com/rabelzx/hu-gateway/internal/pb/transformpb"
)

// requireResearcher garante que o chamador está autenticado e tem o papel
// "pesquisador"; caso contrário responde 401/403 e retorna ok=false.
func requireResearcher(w http.ResponseWriter, r *http.Request) (*auth.Claims, bool) {
	claims, ok := middleware.ClaimsFrom(r.Context())
	if !ok {
		middleware.WriteError(w, http.StatusUnauthorized, "não autenticado")
		return nil, false
	}
	if claims.PrimaryRole() != "pesquisador" {
		middleware.WriteError(w, http.StatusForbidden, "apenas pesquisadores acessam projetos de pesquisa")
		return nil, false
	}
	return claims, true
}

// projectToJSON serializa um ProjectRecord no formato REST consumido pelo front.
func projectToJSON(p *patientpb.ProjectRecord) map[string]any {
	return map[string]any{
		"project_id":            p.GetProjectId(),
		"title":                 p.GetTitle(),
		"researcher_username":   p.GetResearcherUsername(),
		"target_condition_code": p.GetTargetConditionCode(),
		"status":                p.GetStatus(),
		"valid_until":           p.GetValidUntil(),
	}
}

// getOwnedProject busca um projeto na PDS e confirma que pertence ao pesquisador
// autenticado. Retorna 404 quando não existe OU não é do chamador (não vaza a
// existência de projetos de terceiros). ok=false já respondeu ao cliente.
func (g *Gateway) getOwnedProject(w http.ResponseWriter, r *http.Request, claims *auth.Claims, projectID string) (*patientpb.ProjectRecord, bool) {
	ctx, cancel := g.upstreamCtx(r.Context())
	defer cancel()

	start := time.Now()
	project, err := g.clients.Patient.GetProject(ctx, &patientpb.GetProjectRequest{ProjectId: projectID})
	recordUpstream("patient-data-service", "GetProject", start, err)
	if err != nil {
		writeUpstreamError(w, "patient-data-service", err)
		return nil, false
	}
	if project.GetResearcherUsername() != claims.Username {
		middleware.WriteError(w, http.StatusNotFound, "projeto não encontrado")
		return nil, false
	}
	return project, true
}

// ListProjects — GET /api/v1/research/projects
// Lista os projetos do pesquisador autenticado (item iv do enunciado).
func (g *Gateway) ListProjects(w http.ResponseWriter, r *http.Request) {
	claims, ok := requireResearcher(w, r)
	if !ok {
		return
	}

	ctx, cancel := g.upstreamCtx(r.Context())
	defer cancel()

	start := time.Now()
	resp, err := g.clients.Patient.ListProjects(ctx, &patientpb.ListProjectsRequest{ResearcherUsername: claims.Username})
	recordUpstream("patient-data-service", "ListProjects", start, err)
	if err != nil {
		writeUpstreamError(w, "patient-data-service", err)
		return
	}

	projects := make([]map[string]any, 0, len(resp.GetProjects()))
	for _, p := range resp.GetProjects() {
		projects = append(projects, projectToJSON(p))
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"count":    len(projects),
		"projects": projects,
	})
}

// GetProject — GET /api/v1/research/projects/{id}
// Detalhe/status de um projeto do pesquisador.
func (g *Gateway) GetProject(w http.ResponseWriter, r *http.Request) {
	claims, ok := requireResearcher(w, r)
	if !ok {
		return
	}
	project, ok := g.getOwnedProject(w, r, claims, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, projectToJSON(project))
}

// ProjectAggregate — GET /api/v1/research/projects/{id}/aggregate
// Estatísticas agregadas da coorte do projeto. A condição clínica é resolvida
// a partir do próprio projeto (o front não precisa mais informá-la).
func (g *Gateway) ProjectAggregate(w http.ResponseWriter, r *http.Request) {
	claims, ok := requireResearcher(w, r)
	if !ok {
		return
	}
	projectID := chi.URLParam(r, "id")
	project, ok := g.getOwnedProject(w, r, claims, projectID)
	if !ok {
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
		middleware.WriteError(w, http.StatusInternalServerError, "erro de autorização")
		return
	}

	ctx, cancel := g.upstreamCtx(r.Context())
	defer cancel()

	start := time.Now()
	bundle, err := g.clients.Transform.AggregateForResearch(ctx, &transformpb.AggregateRequest{
		ClinicalCondition: project.GetTargetConditionCode(),
		ProjectId:         projectID,
		AccessLevel:       accessLevel,
	})
	recordUpstream("data-transform-service", "AggregateForResearch", start, err)
	if err != nil {
		writeUpstreamError(w, "data-transform-service", err)
		return
	}
	writeJSONPayload(w, "application/json", bundle.GetJsonPayload())
}

// ProjectCohort — GET /api/v1/research/projects/{id}/cohort
// Coorte de pacientes anonimizados do projeto (itens i/iii do enunciado):
// identificador pseudonimizado, faixa etária, sexo — sem nome/CPF/CNS. A
// anonimização é feita aqui pois o Data Transform Service ainda não expõe um
// RPC de coorte anonimizada (só TransformToFhir por paciente e agregação).
func (g *Gateway) ProjectCohort(w http.ResponseWriter, r *http.Request) {
	claims, ok := requireResearcher(w, r)
	if !ok {
		return
	}
	projectID := chi.URLParam(r, "id")
	project, ok := g.getOwnedProject(w, r, claims, projectID)
	if !ok {
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

	condition := project.GetTargetConditionCode()
	ctx, cancel := g.upstreamCtx(r.Context())
	defer cancel()

	start := time.Now()
	cohort, err := g.clients.Patient.GetCohortRaw(ctx, &patientpb.GetCohortRawRequest{ClinicalCondition: condition})
	recordUpstream("patient-data-service", "GetCohortRaw", start, err)
	if err != nil {
		writeUpstreamError(w, "patient-data-service", err)
		return
	}

	patients := make([]map[string]any, 0, len(cohort.GetPatients()))
	for _, p := range cohort.GetPatients() {
		patients = append(patients, map[string]any{
			"pseudonymId": g.pseudonym(p.GetPatientId(), projectID),
			"ageRange":    ageBand(p.GetBirthDate()),
			"gender":      p.GetGender(),
			"condition":   condition,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"accessLevel":       "ANONYMIZED",
		"clinicalCondition": condition,
		"patients":          patients,
	})
}

// pseudonym gera um identificador estável a partir do patient_id, usando um
// HMAC-SHA256 com chave secreta do servidor (não SHA-256 puro: patient_id
// segue um formato enumerável — "P" + dígitos sequenciais — então um hash
// sem chave é reversível por força bruta/rainbow table sobre o espaço de
// ~150 mil IDs conhecidos, o que anularia a garantia de anonimização do
// nível de acesso ANONYMIZED). O projectID entra no HMAC para que o mesmo
// paciente gere pseudônimos diferentes em coortes de projetos diferentes
// (evita cruzar dados entre projetos de pesquisa distintos).
func (g *Gateway) pseudonym(patientID, projectID string) string {
	m := hmac.New(sha256.New, g.cfg.CohortPseudonymKey)
	m.Write([]byte(projectID + ":" + patientID))
	return "anon-" + hex.EncodeToString(m.Sum(nil))[:32]
}

// ageBand converte uma data de nascimento "YYYY-MM-DD" na faixa etária usada
// pelo Data Transform Service ("0-17", "18-39", "40-59", "60+").
func ageBand(birthDate string) string {
	if len(birthDate) < 4 {
		return "desconhecida"
	}
	year, err := strconv.Atoi(birthDate[:4])
	if err != nil {
		return "desconhecida"
	}
	age := time.Now().Year() - year
	switch {
	case age < 18:
		return "0-17"
	case age < 40:
		return "18-39"
	case age < 60:
		return "40-59"
	default:
		return "60+"
	}
}
