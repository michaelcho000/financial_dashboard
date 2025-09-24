import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

import ProtectedRoute from './components/ProtectedRoute';
import StaffLayout from './layouts/StaffLayout';
import AdminLayout from './layouts/AdminLayout';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import IncomeStatementPage from './pages/IncomeStatementPage';
import FixedCostsPage from './pages/FixedCostsPage';
import AccountManagementPage from './pages/AccountManagementPage';
import MonthlyReportPage from './pages/MonthlyReportPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminTenantsPage from './pages/AdminTenantsPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import SettingsPage from './pages/SettingsPage';

const App: React.FC = () => {
    const { currentUser, loading } = useAuth();

    if (loading) {
        return <div className="flex h-screen items-center justify-center">Loading...</div>;
    }

    return (
        <Routes>
            {/* 루트 경로 명시적 처리 */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />

            <Route
                path="/admin/*"
                element={
                    <ProtectedRoute role="superAdmin">
                        <AdminLayout>
                            <Routes>
                                <Route path="" element={<Navigate to="dashboard" replace />} />
                                <Route path="dashboard" element={<AdminDashboardPage />} />
                                <Route path="tenants" element={<AdminTenantsPage />} />
                                <Route path="users" element={<AdminUsersPage />} />
                                <Route path="settings" element={<SettingsPage />} />
                            </Routes>
                        </AdminLayout>
                    </ProtectedRoute>
                }
            />

            <Route 
                path="/*"
                element={
                    <ProtectedRoute role="generalAdmin">
                        <StaffLayout>
                             <Routes>
                                <Route path="dashboard" element={<DashboardPage />} />
                                <Route path="income-statement" element={<IncomeStatementPage />} />
                                <Route path="fixed-costs" element={<FixedCostsPage />} />
                                <Route path="account-management" element={<AccountManagementPage />} />
                                <Route path="reports" element={<MonthlyReportPage />} />
                                <Route path="" element={<Navigate to="dashboard" replace />} />
                                <Route path="*" element={<Navigate to="dashboard" replace />} />
                            </Routes>
                        </StaffLayout>
                    </ProtectedRoute>
                }
            />
            
            <Route 
                path="*" 
                element={
                    <Navigate to={currentUser ? (currentUser.role === 'superAdmin' ? '/admin' : '/dashboard') : '/login'} replace />
                } 
            />
        </Routes>
    );
};

export default App;
