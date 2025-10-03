import React from 'react';
import Sidebar from '../components/Sidebar';
import { FinancialDataProvider } from '../contexts/FinancialDataContext';

const StaffLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <FinancialDataProvider>
            <div className="flex h-screen bg-gray-50 text-gray-800">
                <Sidebar />
                <main className="flex-1 flex flex-col overflow-y-auto">
                    <div className="p-8">
                        {children}
                    </div>
                </main>
            </div>
        </FinancialDataProvider>
    );
};

export default StaffLayout;
