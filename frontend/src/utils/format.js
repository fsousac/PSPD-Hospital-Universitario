export function formatDate(value) {
  if (!value) return 'Não informado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(date);
}

export function genderLabel(value) {
  const labels = {
    male: 'Masculino',
    female: 'Feminino',
    other: 'Outro',
  };
  return labels[value] || 'Não informado';
}

export function protectedValue(value) {
  return value || 'Protegido';
}

