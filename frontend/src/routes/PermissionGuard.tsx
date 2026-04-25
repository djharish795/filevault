import React from 'react';
import { useAuthStore } from '../features/auth/store';
// In reality, this would connect to a React Query hook fetching permissions
// For architecture mockup, we define the signature and logic

interface PermissionGuardProps {
  require: 'can_view' | 'can_upload' | 'can_download' | 'can_delete';
  projectId: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const PermissionGuard = ({ require, projectId, fallback = null, children }: PermissionGuardProps) => {
  const user = useAuthStore((state) => state.user);
  
  // mock active permissions hook
  // const { data: permissions, isLoading } = usePermissions(projectId);
  const permissions = { can_view: true, can_upload: true, can_download: true, can_delete: false };
  const isLoading = false;

  if (isLoading) return null;

  if (user?.isMasterAdmin) {
    return <>{children}</>;
  }

  const hasAccess = permissions[require];

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
