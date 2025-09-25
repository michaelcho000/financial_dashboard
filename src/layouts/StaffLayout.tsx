import React from 'react';
import Sidebar from '../components/Sidebar';
import { FinancialDataProvider } from '../contexts/FinancialDataContext';
import { CostingServicesProvider } from '../contexts/CostingServicesContext';

const StaffLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <FinancialDataProvider>
            <CostingServicesProvider>
                <div className="flex h-screen bg-gray-50 text-gray-800">
                    <Sidebar />
                    <main className="flex-1 flex flex-col overflow-y-auto">
                        <div className="p-8">
                            {children}
                        </div>
                    </main>
                </div>
            </CostingServicesProvider>
        </FinancialDataProvider>
    );
};

export default StaffLayout;
