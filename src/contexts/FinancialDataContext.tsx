import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
import useFinancialData from '../hooks/useFinancialData';
import { UseFinancialDataReturn, User, Tenant } from '../types';
import { useAuth } from './AuthContext';
import DatabaseService from '../services/DatabaseService';
import UserPreferenceService from '../services/UserPreferenceService';

type FinancialContextType = UseFinancialDataReturn & {
    currentUser: User | null;
    currentTenant: Tenant | null;
    currentMonths: [string, string | null];
    setCurrentMonths: React.Dispatch<React.SetStateAction<[string, string | null]>>;
};

const FinancialDataContext = createContext<FinancialContextType | null>(null);

interface FinancialDataProviderProps {
    children: React.ReactNode;
    tenantId?: string; // SuperAdmin preview-mode tenantId override
}

export const FinancialDataProvider: React.FC<FinancialDataProviderProps> = ({ children, tenantId }) => {
    const { currentUser, activeTenantId } = useAuth();

    // Use the explicit tenantId when provided (SuperAdmin preview mode); otherwise fallback to the authenticated tenant.
    const effectiveTenantId = tenantId || activeTenantId;
    const financialData = useFinancialData(effectiveTenantId);

    const [currentMonths, setCurrentMonthsState] = useState<[string, string | null]>(() => [
        UserPreferenceService.getFallbackPrimaryMonth(),
        null,
    ]);

    const currentTenant = effectiveTenantId ? DatabaseService.getTenant(effectiveTenantId) : null;

    const updateCurrentMonths = useCallback((value: React.SetStateAction<[string, string | null]>) => {
        setCurrentMonthsState(prev => {
            const nextValue = typeof value === 'function' ? value(prev) : value;
            const [nextPrimary, nextComparisonRaw] = nextValue;
            if (typeof nextPrimary !== 'string' || nextPrimary.length === 0) {
                return prev;
            }
            const normalizedComparison =
                typeof nextComparisonRaw === 'string' && nextComparisonRaw.length > 0 && nextComparisonRaw !== nextPrimary
                    ? nextComparisonRaw
                    : null;
            const nextState: [string, string | null] = [nextPrimary, normalizedComparison];
            const hasChanged = prev[0] !== nextState[0] || prev[1] !== nextState[1];
            if (hasChanged && currentUser?.id && effectiveTenantId) {
                UserPreferenceService.setStatementMonths(currentUser.id, effectiveTenantId, nextState);
            }
            return hasChanged ? nextState : prev;
        });
    }, [currentUser?.id, effectiveTenantId]);

    useEffect(() => {
        if (!financialData || !currentUser?.id || !effectiveTenantId) {
            return;
        }

        const stored = UserPreferenceService.getStatementMonths(currentUser.id, effectiveTenantId);
        const resolved = UserPreferenceService.resolveInitialStatementMonths({
            storedPrimary: stored.primary,
            storedComparison: stored.comparison,
            availableMonths: financialData.statement.availableMonths,
            defaultSourceMonth: financialData.getDefaultSourceMonth(),
            fallbackMonth: currentMonths[0],
        });

        const nextPrimary = resolved.primary ?? UserPreferenceService.getFallbackPrimaryMonth();
        const nextComparison = resolved.comparison ?? null;

        updateCurrentMonths(prev => {
            const hasChanged = prev[0] !== nextPrimary || prev[1] !== nextComparison;
            return hasChanged ? [nextPrimary, nextComparison] : prev;
        });
    }, [financialData, currentUser, effectiveTenantId, currentMonths[0], updateCurrentMonths]);

    const value = useMemo((): FinancialContextType | null => {
        if (!financialData || !currentUser) return null;

        return {
            ...financialData,
            currentUser,
            currentTenant,
            currentMonths,
            setCurrentMonths: updateCurrentMonths,
        };
    }, [financialData, currentUser, currentTenant, currentMonths, updateCurrentMonths]);

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
