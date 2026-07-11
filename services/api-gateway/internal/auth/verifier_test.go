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
