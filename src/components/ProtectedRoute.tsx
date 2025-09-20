import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  role: 'superAdmin' | 'generalAdmin';
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, role }) => {
  const { currentUser, activeTenantId } = useAuth();
  const location = useLocation();

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // SuperAdmin can access both admin and generalAdmin pages
  if (currentUser.role === 'superAdmin') {
    // SuperAdmin이 GeneralAdmin 페이지에 접근할 때는 병원이 선택되어 있어야 함
    if (role === 'generalAdmin' && !activeTenantId) {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <>{children}</>;
  }

  if (currentUser.role === 'generalAdmin') {
    if (role !== 'generalAdmin') {
      return <Navigate to="/dashboard" replace />;
    }
    return <>{children}</>;
  }

  // superAdmin 이외의 역할은 현재 정의되어 있지 않지만, 안전하게 대시보드로 이동
  return <Navigate to="/dashboard" replace />;
};

export default ProtectedRoute;
