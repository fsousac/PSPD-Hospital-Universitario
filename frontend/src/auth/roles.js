export const ROLES = {
  DOCTOR: 'medico',
  INTERN: 'estagiario',
  RESEARCHER: 'pesquisador',
};

export const ACCESS_LEVELS = {
  FULL: 'FULL',
  PARTIAL: 'PARTIAL',
  ANONYMIZED: 'ANONYMIZED',
  AGGREGATED: 'AGGREGATED',
};

export function hasRole(user, role) {
  return Boolean(user?.roles?.includes(role));
}

export function getPrimaryRole(user) {
  if (hasRole(user, ROLES.DOCTOR)) return ROLES.DOCTOR;
  if (hasRole(user, ROLES.INTERN)) return ROLES.INTERN;
  if (hasRole(user, ROLES.RESEARCHER)) return ROLES.RESEARCHER;
  return null;
}

export function roleLabel(role) {
  const labels = {
    [ROLES.DOCTOR]: 'Médico',
    [ROLES.INTERN]: 'Estagiário',
    [ROLES.RESEARCHER]: 'Pesquisador',
  };
  return labels[role] || 'Perfil não reconhecido';
}

