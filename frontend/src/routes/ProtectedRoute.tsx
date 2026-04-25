import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../features/auth/store';

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = useAuthStore((state) => state.token);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
