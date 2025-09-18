import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import { FinancialDataProvider } from './contexts/FinancialDataContext';
import IncomeStatementPage from './components/IncomeStatementPage';
import FixedCostsPage from './components/FixedCostsPage';
import AccountManagementPage from './components/AccountManagementPage';
import DashboardPage from './components/DashboardPage';

const AppContent: React.FC = () => {
    return (
        <div className="flex h-screen bg-gray-50 text-gray-800">
            <Sidebar />
            <main className="flex-1 flex flex-col overflow-y-auto">
                <div className="p-8">
                    <Routes>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/dashboard" element={<DashboardPage />} />
                        <Route path="/income-statement" element={<IncomeStatementPage />} />
                        <Route path="/fixed-costs" element={<FixedCostsPage />} />
                        <Route path="/account-management" element={<AccountManagementPage />} />
                    </Routes>
                </div>
            </main>
        </div>
    );
};

const App: React.FC = () => {
    return (
        <FinancialDataProvider>
            <AppContent />
        </FinancialDataProvider>
    );
};

export default App;