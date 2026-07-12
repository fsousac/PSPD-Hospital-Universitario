import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LoadingState } from '../components/LoadingState.jsx';
import { ErrorState } from '../components/ErrorState.jsx';
import { useAuth } from './AuthProvider.jsx';

export function ProtectedRoute({ allowedRoles }) {
  const { isAuthenticated, isLoading, isError, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingState message="Validando sessão" />;
  }

  if (isError) {
    return <ErrorState message="Não foi possível validar a sessão com o provedor de identidade." onRetry={() => window.location.reload()} />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles?.length && !allowedRoles.some((role) => user?.roles?.includes(role))) {
    return <Navigate to="/forbidden" replace />;
  }

  return <Outlet />;
}
