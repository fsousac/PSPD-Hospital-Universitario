package auth

import "testing"

// Regressão: o realm compartilhado do cluster (grupoXX) provisiona roles em
// maiúsculas (MEDICO/ESTAGIARIO/PESQUISADOR), diferente do realm "hu" local
// (minúsculas). normalizeRoles + PrimaryRole devem funcionar em ambos os casos.
func TestPrimaryRoleComRolesEmMaiusculas(t *testing.T) {
	claims := Claims{Roles: normalizeRoles([]string{"MEDICO"})}
	if got := claims.PrimaryRole(); got != "medico" {
		t.Fatalf("PrimaryRole() = %q, esperado %q", got, "medico")
	}
}

func TestPrimaryRoleComRolesEmMinusculas(t *testing.T) {
	claims := Claims{Roles: normalizeRoles([]string{"medico"})}
	if got := claims.PrimaryRole(); got != "medico" {
		t.Fatalf("PrimaryRole() = %q, esperado %q", got, "medico")
	}
}

func TestPrimaryRolePrioridadeMedicoSobreEstagiario(t *testing.T) {
	claims := Claims{Roles: normalizeRoles([]string{"ESTAGIARIO", "MEDICO"})}
	if got := claims.PrimaryRole(); got != "medico" {
		t.Fatalf("PrimaryRole() = %q, esperado %q", got, "medico")
	}
}

func TestPrimaryRoleSemRoleConhecida(t *testing.T) {
	claims := Claims{Roles: normalizeRoles([]string{"admin"})}
	if got := claims.PrimaryRole(); got != "" {
		t.Fatalf("PrimaryRole() = %q, esperado vazio", got)
	}
}

// Regressão: o realm compartilhado do cluster (grupoXX) emite tokens
// "lightweight" sem "realm_access" — o papel vem em "groups", junto com
// ruído (default-roles-*, offline_access, uma_authorization).
func TestRolesFromClaimsComGroupsClaim(t *testing.T) {
	var ra realmAccess
	ra.Groups = []string{"default-roles-grupo10", "offline_access", "MEDICO", "uma_authorization"}

	roles := rolesFromClaims(ra)
	claims := Claims{Roles: roles}
	if got := claims.PrimaryRole(); got != "medico" {
		t.Fatalf("PrimaryRole() = %q, esperado %q (roles extraídas: %v)", got, "medico", roles)
	}
}

func TestRolesFromClaimsPrefereRealmAccessQuandoPresente(t *testing.T) {
	var ra realmAccess
	ra.RealmAccess.Roles = []string{"MEDICO"}
	ra.Groups = []string{"pesquisador"}

	roles := rolesFromClaims(ra)
	claims := Claims{Roles: roles}
	if got := claims.PrimaryRole(); got != "medico" {
		t.Fatalf("PrimaryRole() = %q, esperado %q (deveria ignorar groups quando realm_access existe)", got, "medico")
	}
}
