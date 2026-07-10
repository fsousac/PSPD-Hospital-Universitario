import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LoadingState } from '../components/LoadingState.jsx';
import { useAuth } from './AuthProvider.jsx';

export function ProtectedRoute({ allowedRoles }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingState message="Validando sessão" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles?.length && !allowedRoles.some((role) => user?.roles?.includes(role))) {
    return <Navigate to="/forbidden" replace />;
  }

  return <Outlet />;
}

