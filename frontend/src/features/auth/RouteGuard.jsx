import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth.js';

export function RouteGuard({ roles, platformAdmin = false }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (platformAdmin && !user.is_platform_admin) return <Navigate to="/" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={user.is_platform_admin ? '/admin' : user.role === 'recruiter' ? '/recruiter' : '/candidate'} replace />;
  return <Outlet />;
}
