import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../auth/ProtectedRoute.jsx';
import { ROLES } from '../auth/roles.js';
import { AppLayout } from '../layouts/AppLayout.jsx';
import { Forbidden } from '../pages/Forbidden.jsx';
import { Login } from '../pages/Login.jsx';
import { NotFound } from '../pages/NotFound.jsx';
import { LoadingState } from '../components/LoadingState.jsx';

const Dashboard = lazy(() => import('../pages/Dashboard.jsx').then((module) => ({ default: module.Dashboard })));
const Patients = lazy(() => import('../pages/Patients.jsx').then((module) => ({ default: module.Patients })));
const PatientDetails = lazy(() => import('../pages/PatientDetails.jsx').then((module) => ({ default: module.PatientDetails })));
const ResearchProjects = lazy(() => import('../pages/ResearchProjects.jsx').then((module) => ({ default: module.ResearchProjects })));
const ResearchProjectDetails = lazy(() => import('../pages/ResearchProjectDetails.jsx').then((module) => ({ default: module.ResearchProjectDetails })));

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forbidden" element={<Forbidden />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Suspense fallback={<LoadingState message="Carregando dashboard" />}><Dashboard /></Suspense>} />
          <Route element={<ProtectedRoute allowedRoles={[ROLES.DOCTOR, ROLES.INTERN]} />}>
            <Route path="/patients" element={<Suspense fallback={<LoadingState message="Carregando pacientes" />}><Patients /></Suspense>} />
            <Route path="/patients/:patientId" element={<Suspense fallback={<LoadingState message="Carregando prontuário" />}><PatientDetails /></Suspense>} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={[ROLES.RESEARCHER]} />}>
            <Route path="/research/projects" element={<Suspense fallback={<LoadingState message="Carregando projetos" />}><ResearchProjects /></Suspense>} />
            <Route path="/research/projects/:projectId" element={<Suspense fallback={<LoadingState message="Carregando projeto" />}><ResearchProjectDetails /></Suspense>} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
