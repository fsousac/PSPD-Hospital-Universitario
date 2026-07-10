import { apiFetch } from './client.js';

export function getCurrentUser() {
  return apiFetch('/me');
}

