import { apiFetch } from './client.js';
import { env } from '../config/env.js';

export function listPatients() {
  return apiFetch('/api/v1/me/patients').then((payload) => ({
    accessLevel: payload.accessLevel || (payload.role === 'estagiario' ? 'PARTIAL' : 'FULL'),
    patients: (payload.patients || []).map(normalizeListPatient),
  }));
}

export function getPatient(patientId) {
  return apiFetch(`/api/v1/patients/${patientId}`);
}

export function getClinicalSummary(patientId) {
  if (env.authMode === 'mock') {
    return apiFetch(`/api/v1/patients/${patientId}/summary`);
  }
  return getPatient(patientId).then((payload) => bundleToClinicalSummary(unwrapBundle(payload)));
}

export function listEncounters(patientId) {
  return getClinicalSummary(patientId).then((summary) => ({ encounters: summary.recentEncounters }));
}

export function listClinicalEvents(patientId, type) {
  return getClinicalSummary(patientId).then((summary) => ({
    events: type ? eventsForType(summary, type) : [...summary.diagnoses, ...summary.exams, ...summary.medications],
  }));
}

export function getFhirBundle(patientId) {
  if (env.authMode === 'mock') {
    return apiFetch(`/api/v1/patients/${patientId}/fhir`);
  }
  return getPatient(patientId).then((payload) => ({ jsonPayload: unwrapBundle(payload) }));
}

function normalizeListPatient(patient) {
  return {
    patientId: patient.patient_id || patient.patientId,
    fullName: patient.name || patient.fullName,
    gender: patient.gender,
    state: patient.state,
  };
}

export function unwrapBundle(payload) {
  if (typeof payload === 'string') return JSON.parse(payload);
  if (payload?.jsonPayload) {
    return typeof payload.jsonPayload === 'string' ? JSON.parse(payload.jsonPayload) : payload.jsonPayload;
  }
  return payload;
}

function bundleToClinicalSummary(bundle) {
  const resources = (bundle?.entry || []).map((entry) => entry.resource).filter(Boolean);
  const patientResource = resources.find((resource) => resource.resourceType === 'Patient') || {};
  const patient = patientFromFhir(patientResource);
  return {
    accessLevel: patient.cpf || patient.cns ? 'FULL' : 'PARTIAL',
    patient,
    recentEncounters: resources.filter((resource) => resource.resourceType === 'Encounter').map(encounterFromFhir),
    diagnoses: resources.filter((resource) => resource.resourceType === 'Condition').map(conditionFromFhir),
    exams: resources.filter((resource) => resource.resourceType === 'Observation').map(observationFromFhir),
    medications: resources.filter((resource) => resource.resourceType === 'MedicationRequest').map(medicationFromFhir),
  };
}

function patientFromFhir(resource) {
  const identifiers = resource.identifier || [];
  return {
    patientId: resource.id,
    fullName: resource.name?.[0]?.text,
    birthDate: resource.birthDate || resource.extension?.find((item) => item.url?.endsWith('/age-band'))?.valueString,
    gender: resource.gender,
    city: resource.address?.[0]?.city,
    state: resource.address?.[0]?.state,
    cpf: identifiers.find((item) => item.system?.endsWith('13.237'))?.value,
    cns: identifiers.find((item) => item.system?.endsWith('13.236'))?.value,
  };
}

function encounterFromFhir(resource) {
  return {
    encounterId: resource.id,
    startDate: resource.period?.start,
    endDate: resource.period?.end,
    type: resource.class?.display,
    department: resource.serviceType?.text,
  };
}

function conditionFromFhir(resource) {
  return {
    eventId: resource.id,
    eventType: 'Condição',
    eventCode: resource.code?.coding?.[0]?.code,
    description: resource.code?.text || resource.code?.coding?.[0]?.display,
    eventDate: resource.onsetDateTime,
  };
}

function observationFromFhir(resource) {
  const quantity = resource.valueQuantity;
  return {
    eventId: resource.id,
    eventType: 'Observação',
    eventCode: resource.code?.coding?.[0]?.code,
    description: resource.code?.text || resource.code?.coding?.[0]?.display,
    eventDate: resource.effectiveDateTime,
    value: quantity?.value?.toString() || resource.valueString,
    unit: quantity?.unit,
  };
}

function medicationFromFhir(resource) {
  return {
    eventId: resource.id,
    eventType: 'Medicação',
    eventCode: resource.medicationCodeableConcept?.coding?.[0]?.code,
    description: resource.medicationCodeableConcept?.text || resource.medicationCodeableConcept?.coding?.[0]?.display,
    eventDate: resource.authoredOn,
  };
}

function eventsForType(summary, type) {
  return { diagnoses: summary.diagnoses, exams: summary.exams, medications: summary.medications }[type] || [];
}
