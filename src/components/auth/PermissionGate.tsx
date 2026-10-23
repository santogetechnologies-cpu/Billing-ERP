import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { AppModule, AppAction, hasPermission } from '../../utils/rbac';

interface PermissionGateProps {
  module: AppModule;
  action?: AppAction;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Conditionally renders UI elements (such as Delete/Approve buttons, Export options,
 * or entire component sections) only if the authenticated user's role has the required permission.
 */
export const PermissionGate: React.FC<PermissionGateProps> = ({
  module,
  action = 'view',
  children,
  fallback = null
}) => {
  const { profile } = useAuth();
  const allowed = hasPermission(profile?.role, module, action);

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
