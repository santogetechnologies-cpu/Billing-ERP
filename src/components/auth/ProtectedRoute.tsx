import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';
import { AppModule, AppAction, hasPermission, getRoleDefaultRoute, canAccessRoute } from '../../utils/rbac';
import { UserRole } from '../../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredModule?: AppModule;
  requiredAction?: AppAction;
  customValidator?: (role?: UserRole | string | null) => boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredModule,
  requiredAction = 'view',
  customValidator
}) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
        <p className="text-slate-400 font-medium">Authenticating & Verifying Role Permissions...</p>
      </div>
    );
  }

  // 1. Unauthenticated users -> Redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const userRole = profile?.role;

  // 2. Custom validator check (e.g. Barcode Override or Owner-only policies)
  if (customValidator && !customValidator(userRole)) {
    const fallbackRoute = getRoleDefaultRoute(userRole) || '/';
    if (location.pathname === fallbackRoute) {
      return <Navigate to="/login" replace />;
    }
    return <Navigate to={fallbackRoute} replace />;
  }

  // 3. Central route-level access control check
  if (!canAccessRoute(userRole, location.pathname)) {
    const fallbackRoute = getRoleDefaultRoute(userRole) || '/';
    if (location.pathname === fallbackRoute) {
      return <Navigate to="/login" replace />;
    }
    return <Navigate to={fallbackRoute} replace />;
  }

  // 3. Module permission RBAC enforcement
  if (requiredModule) {
    const isAuthorized = hasPermission(userRole, requiredModule, requiredAction);

    if (!isAuthorized) {
      const fallbackRoute = getRoleDefaultRoute(userRole) || '/';
      // Prevent infinite redirect loops if current path matches fallback route
      if (location.pathname === fallbackRoute) {
        return <Navigate to="/login" replace />;
      }
      return <Navigate to={fallbackRoute} replace />;
    }
  }

  // 4. Authorized -> Render protected route content
  return <>{children}</>;
};
