// Package auth faz a verificação do JWT na borda do gateway.
//
// Divisão de responsabilidades (ver ADR 0004):
//   - AQUI (borda): valida assinatura/expiração/emissor do JWT contra o JWKS do
//     Keycloak e extrai username + roles. É a etapa "(ii) validar tokens JWT" do
//     enunciado. Barata e feita em toda requisição.
//   - Authorization Service (Felipe): decide ALLOW/DENY + nível de acesso
//     consultando os vínculos no banco. Chamado só nas rotas de recurso clínico.
package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/coreos/go-oidc/v3/oidc"
)

// Claims são os dados que o gateway extrai do JWT do Keycloak.
type Claims struct {
	Subject  string   // sub (UUID do usuário no Keycloak)
	Username string   // preferred_username (ex.: dr.silva) — casado com o seed do banco
	Roles    []string // realm_access.roles (medico | estagiario | pesquisador)
	Raw      string   // token original, repassado ao Authorization Service
}

// Role principal do usuário, aplicando a prioridade médico > estagiário >
// pesquisador (mesma regra do Authorization Service, ver ADR 0001).
func (c Claims) PrimaryRole() string {
	priority := []string{"medico", "estagiario", "pesquisador"}
	set := make(map[string]bool, len(c.Roles))
	for _, r := range c.Roles {
		set[r] = true
	}
	for _, r := range priority {
		if set[r] {
			return r
		}
	}
	return ""
}

// Verifier encapsula o verificador OIDC apontado para o realm do Keycloak.
type Verifier struct {
	verifier       *oidc.IDTokenVerifier
	expectedIssuer string
}

// NewVerifier faz a descoberta OIDC do issuer (busca o JWKS) e monta o
// verificador. O cliente HTTP do go-oidc cacheia e renova as chaves.
func NewVerifier(ctx context.Context, discoveryIssuerURL, expectedIssuerURL, clientID string) (*Verifier, error) {
	provider, err := oidc.NewProvider(ctx, discoveryIssuerURL)
	if err != nil {
		return nil, fmt.Errorf("descoberta OIDC em %q falhou: %w", discoveryIssuerURL, err)
	}
	cfg := &oidc.Config{ClientID: clientID}
	if expectedIssuerURL != "" && expectedIssuerURL != discoveryIssuerURL {
		// A descoberta pode usar a rede interna do Docker, enquanto o token
		// emitido para o navegador usa a URL pública. O issuer continua sendo
		// validado manualmente abaixo contra a URL pública configurada.
		cfg.SkipIssuerCheck = true
	}
	// Tokens do Keycloak costumam ter aud="account"; quando não configuramos um
	// client_id específico, desligamos a checagem de audience para não travar o
	// fluxo em ambiente acadêmico.
	if clientID == "" {
		cfg.SkipClientIDCheck = true
	}
	return &Verifier{verifier: provider.Verifier(cfg), expectedIssuer: strings.TrimRight(expectedIssuerURL, "/")}, nil
}

// realmAccess mapeia os claims de papel do Keycloak: realm_access.roles no
// caso normal, ou groups como fallback (ver rolesFromClaims).
type realmAccess struct {
	RealmAccess struct {
		Roles []string `json:"roles"`
	} `json:"realm_access"`
	Groups            []string `json:"groups"`
	PreferredUsername string   `json:"preferred_username"`
}

// knownRoles filtra ruído do claim "groups" (default-roles-*, offline_access,
// uma_authorization) — só os 3 papéis de aplicação interessam.
var knownRoles = map[string]bool{"medico": true, "estagiario": true, "pesquisador": true}

// rolesFromClaims extrai os papéis do token. O realm compartilhado do
// cluster (grupoXX) emite tokens "lightweight" sem "realm_access" — o papel
// vem no claim "groups" (client scope microprofile-jwt) junto com ruído.
// Ver docs/decisions/0005 e o mesmo fallback em
// services/authorization-service TokenValidationService.extractRealmRoles.
func rolesFromClaims(ra realmAccess) []string {
	if len(ra.RealmAccess.Roles) > 0 {
		return normalizeRoles(ra.RealmAccess.Roles)
	}
	var out []string
	for _, g := range normalizeRoles(ra.Groups) {
		if knownRoles[g] {
			out = append(out, g)
		}
	}
	return out
}

// Verify valida o token e retorna as claims relevantes.
func (v *Verifier) Verify(ctx context.Context, rawToken string) (*Claims, error) {
	if rawToken == "" {
		return nil, errors.New("token vazio")
	}
	idToken, err := v.verifier.Verify(ctx, rawToken)
	if err != nil {
		return nil, fmt.Errorf("token inválido: %w", err)
	}
	if v.expectedIssuer != "" && strings.TrimRight(idToken.Issuer, "/") != v.expectedIssuer {
		return nil, fmt.Errorf("issuer do token não autorizado")
	}
	var ra realmAccess
	if err := idToken.Claims(&ra); err != nil {
		return nil, fmt.Errorf("falha ao ler claims: %w", err)
	}
	return &Claims{
		Subject:  idToken.Subject,
		Username: ra.PreferredUsername,
		Roles:    rolesFromClaims(ra),
		Raw:      rawToken,
	}, nil
}

// normalizeRoles baixa o case das roles: o realm "hu" local usa roles
// minúsculas, mas o realm compartilhado do cluster (grupoXX) provisiona
// MEDICO/ESTAGIARIO/PESQUISADOR em maiúsculas. PrimaryRole() compara sempre
// lowercase.
func normalizeRoles(roles []string) []string {
	out := make([]string, len(roles))
	for i, r := range roles {
		out[i] = strings.ToLower(r)
	}
	return out
}
