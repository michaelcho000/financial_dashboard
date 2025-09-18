import React, { createContext, useContext, useState, useMemo } from 'react';
import useFinancialData from '../hooks/useFinancialData';
import { UseFinancialDataReturn, User, Tenant } from '../types';
import { useAuth } from './AuthContext';
import DatabaseService from '../services/DatabaseService';

type FinancialContextType = UseFinancialDataReturn & {
    currentUser: User | null;
    currentTenant: Tenant | null;
    currentMonths: [string, string | null];
    setCurrentMonths: React.Dispatch<React.SetStateAction<[string, string | null]>>;
};

const FinancialDataContext = createContext<FinancialContextType | null>(null);

interface FinancialDataProviderProps {
    children: React.ReactNode;
    tenantId?: string; // SuperAdmin 프리뷰 모드용 tenantId override
}

export const FinancialDataProvider: React.FC<FinancialDataProviderProps> = ({ children, tenantId }) => {
    const { currentUser, activeTenantId } = useAuth();

    // tenantId prop이 있으면 (SuperAdmin 프리뷰 모드) 그것을 사용, 없으면 기존 로직
    const effectiveTenantId = tenantId || activeTenantId;
    const financialData = useFinancialData(effectiveTenantId);

    const [currentMonths, setCurrentMonths] = useState<[string, string | null]>(['2025-08', null]);

    const currentTenant = effectiveTenantId ? DatabaseService.getTenant(effectiveTenantId) : null;

    const value = useMemo((): FinancialContextType | null => {
        if (!financialData || !currentUser) return null;

        return {
            ...financialData,
            currentUser,
            currentTenant,
            currentMonths,
            setCurrentMonths,
        };
    }, [financialData, currentUser, currentTenant, currentMonths]);

    if (!value) {
        return <div className="flex h-screen items-center justify-center">Loading financial data...</div>;
    }

    return (
        <FinancialDataContext.Provider value={value}>
            {children}
        </FinancialDataContext.Provider>
    );
};

export const useFinancials = (): FinancialContextType => {
    const context = useContext(FinancialDataContext);
    if (context === null) {
        throw new Error('useFinancials must be used within a FinancialDataProvider');
    }
    return context;
};