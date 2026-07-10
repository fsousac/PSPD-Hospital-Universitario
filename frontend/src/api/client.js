import { env } from '../config/env.js';
import { createCorrelationId } from './correlation.js';
import { ApiError, userMessageForStatus } from './errors.js';

let tokenProvider = async () => null;
let unauthorizedHandler = () => {};

export function configureApiClient({ getToken, onUnauthorized } = {}) {
  tokenProvider = getToken || tokenProvider;
  unauthorizedHandler = onUnauthorized || unauthorizedHandler;
}

export async function apiFetch(path, options = {}) {
  const correlationId = createCorrelationId();
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || 15000;
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener('abort', abortFromCaller, { once: true });
  const token = await tokenProvider();
  const headers = new Headers(options.headers);

  headers.set('Accept', 'application/json');
  headers.set('X-Correlation-ID', correlationId);
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const response = await fetch(`${env.apiBaseUrl}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
      body: options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body,
    });

    if (response.status === 401) {
      unauthorizedHandler();
    }

    if (!response.ok) {
      let payload = {};
      try {
        payload = await response.json();
      } catch {
        payload = {};
      }
      throw new ApiError({
        status: response.status,
        code: payload.code,
        message: payload.message || userMessageForStatus(response.status),
        correlationId: response.headers.get('X-Correlation-ID') || correlationId,
      });
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ApiError({
        status: 0,
        message: 'Tempo limite excedido ao consultar o serviço.',
        code: 'REQUEST_TIMEOUT',
        correlationId,
      });
    }
    if (error instanceof ApiError) throw error;
    throw new ApiError({
      status: 0,
      message: 'Não foi possível conectar ao serviço. Verifique sua rede e tente novamente.',
      code: 'NETWORK_UNAVAILABLE',
      correlationId,
    });
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }
}
