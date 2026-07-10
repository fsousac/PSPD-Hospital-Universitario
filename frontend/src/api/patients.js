import { apiFetch } from './client.js';

export function listPatients() {
  return apiFetch('/patients');
}

export function getPatient(patientId) {
  return apiFetch(`/patients/${patientId}`);
}

export function getClinicalSummary(patientId) {
  return apiFetch(`/patients/${patientId}/summary`);
}

export function listEncounters(patientId) {
  return apiFetch(`/patients/${patientId}/encounters`);
}

export function listClinicalEvents(patientId, type) {
  const params = type ? `?type=${encodeURIComponent(type)}` : '';
  return apiFetch(`/patients/${patientId}/events${params}`);
}

export function getFhirBundle(patientId) {
  return apiFetch(`/patients/${patientId}/fhir`);
}

