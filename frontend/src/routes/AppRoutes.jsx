import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../auth/ProtectedRoute.jsx';
import { ROLES } from '../auth/roles.js';
import { AppLayout } from '../layouts/AppLayout.jsx';
import { Dashboard } from '../pages/Dashboard.jsx';
import { Forbidden } from '../pages/Forbidden.jsx';
import { Login } from '../pages/Login.jsx';
import { NotFound } from '../pages/NotFound.jsx';
import { PatientDetails } from '../pages/PatientDetails.jsx';
import { Patients } from '../pages/Patients.jsx';
import { ResearchProjectDetails } from '../pages/ResearchProjectDetails.jsx';
import { ResearchProjects } from '../pages/ResearchProjects.jsx';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forbidden" element={<Forbidden />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route element={<ProtectedRoute allowedRoles={[ROLES.DOCTOR, ROLES.INTERN]} />}>
            <Route path="/patients" element={<Patients />} />
            <Route path="/patients/:patientId" element={<PatientDetails />} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={[ROLES.RESEARCHER]} />}>
            <Route path="/research/projects" element={<ResearchProjects />} />
            <Route path="/research/projects/:projectId" element={<ResearchProjectDetails />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

