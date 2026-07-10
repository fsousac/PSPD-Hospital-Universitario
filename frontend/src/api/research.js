import { apiFetch } from './client.js';

export function listProjects() {
  return apiFetch('/research/projects');
}

export function getProject(projectId) {
  return apiFetch(`/research/projects/${projectId}`);
}

export function getProjectAggregate(projectId) {
  return apiFetch(`/research/projects/${projectId}/aggregate`);
}

export function getProjectCohort(projectId) {
  return apiFetch(`/research/projects/${projectId}/cohort`);
}

