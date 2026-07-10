import { http, HttpResponse } from 'msw';
import { env } from '../config/env.js';
import { clinicalSummary, fhirBundle, partialSummary, patientsFull, patientsPartial } from './fixtures/patients.js';
import { aggregate, cohort, projects } from './fixtures/research.js';

function roleFromRequest({ request }) {
  const auth = request.headers.get('authorization') || '';
  if (auth.includes('pesquisador')) return 'pesquisador';
  if (auth.includes('estagiario')) return 'estagiario';
  return 'medico';
}

function asJson(payload) {
  return HttpResponse.json(payload, {
    headers: {
      'X-Correlation-ID': crypto.randomUUID(),
    },
  });
}

export const handlers = [
  http.get(`${env.apiBaseUrl}/me`, ({ request }) => {
    const role = roleFromRequest({ request });
    const users = {
      medico: { username: 'dr.silva', displayName: 'Dr. Silva', roles: ['medico'] },
      estagiario: { username: 'estagiario.ana', displayName: 'Ana Estagiária', roles: ['estagiario'] },
      pesquisador: { username: 'pesquisador.souza', displayName: 'Souza Pesquisador', roles: ['pesquisador'] },
    };
    return asJson(users[role]);
  }),

  http.get(`${env.apiBaseUrl}/patients`, ({ request }) => {
    const role = roleFromRequest({ request });
    if (role === 'pesquisador') {
      return new HttpResponse(null, { status: 403 });
    }
    return asJson({
      accessLevel: role === 'estagiario' ? 'PARTIAL' : 'FULL',
      patients: role === 'estagiario' ? patientsPartial : patientsFull,
    });
  }),

  http.get(`${env.apiBaseUrl}/patients/:patientId`, ({ request }) => {
    const role = roleFromRequest({ request });
    return asJson(role === 'estagiario' ? partialSummary.patient : clinicalSummary.patient);
  }),

  http.get(`${env.apiBaseUrl}/patients/:patientId/summary`, ({ request }) => {
    const role = roleFromRequest({ request });
    return asJson(role === 'estagiario' ? partialSummary : clinicalSummary);
  }),

  http.get(`${env.apiBaseUrl}/patients/:patientId/encounters`, () => asJson({
    encounters: clinicalSummary.recentEncounters,
  })),

  http.get(`${env.apiBaseUrl}/patients/:patientId/events`, ({ request }) => {
    const type = new URL(request.url).searchParams.get('type');
    const map = {
      diagnoses: clinicalSummary.diagnoses,
      exams: clinicalSummary.exams,
      medications: clinicalSummary.medications,
    };
    return asJson({ events: map[type] || [] });
  }),

  http.get(`${env.apiBaseUrl}/patients/:patientId/fhir`, () => asJson(fhirBundle)),

  http.get(`${env.apiBaseUrl}/research/projects`, ({ request }) => {
    const role = roleFromRequest({ request });
    if (role !== 'pesquisador') {
      return new HttpResponse(null, { status: 403 });
    }
    return asJson({ projects });
  }),

  http.get(`${env.apiBaseUrl}/research/projects/:projectId`, ({ params }) => {
    const project = projects.find((item) => item.projectId === params.projectId);
    return project ? asJson(project) : new HttpResponse(null, { status: 404 });
  }),

  http.get(`${env.apiBaseUrl}/research/projects/:projectId/aggregate`, () => asJson(aggregate)),

  http.get(`${env.apiBaseUrl}/research/projects/:projectId/cohort`, () => asJson(cohort)),
];

