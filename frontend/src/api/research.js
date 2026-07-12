import { apiFetch } from './client.js';
import { env } from '../config/env.js';
import { projects as provisionalProjects } from '../mocks/fixtures/research.js';
import { aggregate, cohort } from '../mocks/fixtures/research.js';

// O backend usa status em inglês maiúsculo (APPROVED/SUSPENDED/...) e códigos
// de condição em maiúsculas (DIABETES/HYPERTENSION); a UI espera rótulos em
// português. Estes mapas fazem a tradução para exibição.
const STATUS_PT = {
  APPROVED: 'Aprovado',
  SUSPENDED: 'Suspenso',
  EXPIRED: 'Expirado',
  PENDING: 'Pendente',
  REJECTED: 'Reprovado',
};

const CONDITION_PT = {
  DIABETES: 'Diabetes',
  HYPERTENSION: 'Hipertensão',
  OBESITY: 'Obesidade',
};

function normalizeProject(project) {
  return {
    projectId: project.project_id || project.projectId,
    title: project.title,
    clinicalCondition:
      CONDITION_PT[project.target_condition_code] ||
      project.target_condition_code ||
      project.clinicalCondition,
    status: STATUS_PT[project.status] || project.status,
    validFrom: project.valid_from || project.validFrom || null,
    validUntil: project.valid_until || project.validUntil,
  };
}

export function listProjects() {
  if (env.authMode === 'mock') {
    return Promise.resolve({ projects: provisionalProjects, source: 'mock' });
  }
  return apiFetch('/api/v1/research/projects').then((payload) => ({
    projects: (payload.projects || []).map(normalizeProject),
  }));
}

export function getProject(projectId) {
  if (env.authMode === 'mock') {
    const project = provisionalProjects.find((item) => item.projectId === projectId);
    return project ? Promise.resolve(project) : Promise.reject(new Error('Projeto não encontrado.'));
  }
  return apiFetch(`/api/v1/research/projects/${projectId}`).then(normalizeProject);
}

export function getProjectAggregate(projectId) {
  if (env.authMode === 'mock') {
    return Promise.resolve(aggregate);
  }
  return apiFetch(`/api/v1/research/projects/${projectId}/aggregate`).then(normalizeAggregate);
}

export function getProjectCohort(projectId) {
  if (env.authMode === 'mock') {
    return Promise.resolve(cohort);
  }
  return apiFetch(`/api/v1/research/projects/${projectId}/cohort`).then((payload) => ({
    accessLevel: payload.accessLevel || 'ANONYMIZED',
    patients: payload.patients || [],
  }));
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
