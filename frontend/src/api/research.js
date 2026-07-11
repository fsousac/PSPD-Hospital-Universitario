import { apiFetch } from './client.js';
import { env } from '../config/env.js';
import { projects as provisionalProjects } from '../mocks/fixtures/research.js';
import { aggregate, cohort } from '../mocks/fixtures/research.js';

export function listProjects() {
  // The current Gateway contract has no project catalog endpoint.
  return Promise.resolve({ projects: provisionalProjects, source: 'provisional' });
}

export function getProject(projectId) {
  const project = provisionalProjects.find((item) => item.projectId === projectId);
  return project ? Promise.resolve(project) : Promise.reject(new Error('Projeto não encontrado.'));
}

export function getProjectAggregate(projectId) {
  if (env.authMode === 'mock') {
    return Promise.resolve(aggregate);
  }
  return getProject(projectId)
    .then((project) => apiFetch(`/api/v1/research/aggregate?condition=${encodeURIComponent(project.clinicalCondition)}&project=${encodeURIComponent(projectId)}`))
    .then(normalizeAggregate);
}

export function getProjectCohort(projectId) {
  if (env.authMode === 'mock') {
    return Promise.resolve(cohort);
  }
  return Promise.resolve({
    accessLevel: 'ANONYMIZED',
    patients: [],
    source: 'unavailable',
    message: 'A Gateway atual ainda não expõe o endpoint de coorte anonimizada.',
  });
}

function normalizeAggregate(payload) {
  return {
    accessLevel: 'AGGREGATED',
    clinicalCondition: payload.clinical_condition,
    totalPatients: payload.total_patients || 0,
    genderDistribution: [
      { name: 'Masculino', value: payload.gender_distribution?.male_pct || 0 },
      { name: 'Feminino', value: payload.gender_distribution?.female_pct || 0 },
      { name: 'Outro', value: payload.gender_distribution?.other_pct || 0 },
    ],
    ageDistribution: Object.entries(payload.age_distribution || {}).map(([name, value]) => ({ name, value })),
    medications: (payload.top_medications || []).map((item) => ({ medication: item.medication, percentage: item.percentage })),
  };
}
