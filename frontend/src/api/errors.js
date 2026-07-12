export class ApiError extends Error {
  constructor({ status, message, code, correlationId }) {
    super(message || 'Erro ao comunicar com o servidor');
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.correlationId = correlationId;
  }
}

export function userMessageForStatus(status) {
  if (status === 401) return 'Sua sessão expirou. Faça login novamente.';
  if (status === 403) return 'Você não tem permissão para acessar este recurso.';
  if (status === 404) return 'Recurso não encontrado.';
  if (status >= 500) return 'O serviço está indisponível no momento.';
  return 'Não foi possível concluir a solicitação.';
}

