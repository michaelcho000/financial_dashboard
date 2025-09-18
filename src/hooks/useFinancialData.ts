import { useState, useMemo, useCallback, useEffect } from 'react';
import { Account, AccountCategory, ManualData, TransactionData, CalculatedMonthData, UseFinancialDataReturn, Transaction, AccountGroups, FixedCostLedgerItem } from '../types';
import DatabaseService from '../services/DatabaseService';

const useFinancialData = (tenantId: string | undefined): UseFinancialDataReturn | null => {
    const [financials, setFinancials] = useState(tenantId ? DatabaseService.getFinancials(tenantId) : null);

    useEffect(() => {
        if (tenantId) {
            setFinancials(DatabaseService.getFinancials(tenantId));
        }
    }, [tenantId]);

    // Effect to save state to DB whenever it changes
    useEffect(() => {
        if (tenantId && financials) {
            DatabaseService.saveFinancials(tenantId, financials);
        }
    }, [tenantId, financials]);

    if (!financials) {
        return null;
    }

    const { accounts, accountGroups, transactionData, manualData, fixedCostLedger } = financials;

    const allAvailableMonths = useMemo(() => {
        const monthsSet = new Set<string>();
        Object.keys(transactionData).forEach(month => monthsSet.add(month));
        Object.keys(manualData).forEach(month => monthsSet.add(month));
        return Array.from(monthsSet).sort();
    }, [transactionData, manualData]);

    const allAccounts = useMemo(() => [
        ...accounts.revenue,
        ...accounts.cogs,
        ...accounts.sgaFixed,
        ...accounts.sgaVariable
    ], [accounts]);

    const addAccount = useCallback((name: string, category: AccountCategory, group: string) => {
        let entryType: 'manual' | 'transaction' = 'transaction';
        if (category === AccountCategory.SGA_FIXED) {
            entryType = 'manual';
        }

        const newAccount: Account = {
            id: `${category.toLowerCase()}-${Date.now()}`,
            name,
            category,
            group,
            isDeletable: true,
            entryType: entryType,
        };
        
        setFinancials(prev => {
            if (!prev) return null;
            const newAccounts = { ...prev.accounts };
            if (category === AccountCategory.REVENUE) newAccounts.revenue.push(newAccount);
            else if (category === AccountCategory.COGS) newAccounts.cogs.push(newAccount);
            else if (category === AccountCategory.SGA_FIXED) newAccounts.sgaFixed.push(newAccount);
            else if (category === AccountCategory.SGA_VARIABLE) newAccounts.sgaVariable.push(newAccount);
            return { ...prev, accounts: newAccounts };
        });

    }, []);

    const removeAccount = useCallback((id: string, category: AccountCategory) => {
        setFinancials(prev => {
            if (!prev) return null;
            const newFin = { ...prev };
            
            // Remove account
            const newAccounts = { ...newFin.accounts };
            if (category === AccountCategory.REVENUE) newAccounts.revenue = newFin.accounts.revenue.filter(a => a.id !== id);
            else if (category === AccountCategory.COGS) newAccounts.cogs = newFin.accounts.cogs.filter(a => a.id !== id);
            else if (category === AccountCategory.SGA_FIXED) newAccounts.sgaFixed = newFin.accounts.sgaFixed.filter(a => a.id !== id);
            else if (category === AccountCategory.SGA_VARIABLE) newAccounts.sgaVariable = newFin.accounts.sgaVariable.filter(a => a.id !== id);
            newFin.accounts = newAccounts;

            // Clean up data
            const cleanupData = (data: any) => {
              const newData = { ...data };
              for (const month in newData) {
                  if (newData[month][id]) {
                      delete newData[month][id];
                  }
              }
              return newData;
            };

            newFin.manualData = cleanupData(newFin.manualData);
            newFin.transactionData = cleanupData(newFin.transactionData);

            if (category === AccountCategory.SGA_FIXED) {
                newFin.fixedCostLedger = newFin.fixedCostLedger.filter(item => item.accountId !== id);
            }

            return newFin;
        });
    }, []);

     const updateAccount = useCallback((accountId: string, updates: Partial<Pick<Account, 'name' | 'group'>>) => {
        const update = (accs: Account[]) => accs.map(a => a.id === accountId ? { ...a, ...updates } : a);
        setFinancials(prev => {
            if (!prev) return null;
            return {
                ...prev,
                accounts: {
                    revenue: update(prev.accounts.revenue),
                    cogs: update(prev.accounts.cogs),
                    sgaFixed: update(prev.accounts.sgaFixed),
                    sgaVariable: update(prev.accounts.sgaVariable),
                }
            };
        });
    }, []);
    
    const updateManualAccountValue = useCallback((month: string, accountId: string, value: number) => {
        setFinancials(prev => {
            if (!prev) return null;
            return {
                ...prev,
                manualData: {
                    ...prev.manualData,
                    [month]: {
                        ...(prev.manualData[month] || {}),
                        [accountId]: value,
                    },
                }
            };
        });
    }, []);
    
    const setTransactionAccountTotal = useCallback((month: string, accountId: string, totalAmount: number, accountName: string) => {
        const newTransaction: Transaction = {
            id: `t-${Date.now()}`,
            description: accountName,
            amount: totalAmount,
        };
        setFinancials(prev => {
            if (!prev) return null;
            return {
                ...prev,
                transactionData: {
                    ...prev.transactionData,
                    [month]: {
                        ...(prev.transactionData[month] || {}),
                        [accountId]: [newTransaction],
                    },
                }
            };
        });
    }, []);

    const addTransaction = useCallback((month: string, accountId: string, transaction: Omit<Transaction, 'id'>) => {
        const newTransaction: Transaction = { ...transaction, id: `t-${Date.now()}` };
        setFinancials(prev => {
            if (!prev) return null;
            const monthData = prev.transactionData[month]?.[accountId] || [];
            return {
                ...prev,
                transactionData: {
                    ...prev.transactionData,
                    [month]: {
                        ...(prev.transactionData[month] || {}),
                        [accountId]: [...monthData, newTransaction],
                    },
                }
            };
        });
    }, []);

    const removeTransaction = useCallback((month: string, accountId: string, transactionId: string) => {
        setFinancials(prev => {
            if (!prev) return null;
            const monthData = prev.transactionData[month]?.[accountId] || [];
            return {
                ...prev,
                transactionData: {
                    ...prev.transactionData,
                    [month]: {
                        ...prev.transactionData[month],
                        [accountId]: monthData.filter(t => t.id !== transactionId),
                    },
                }
            };
        });
    }, []);

    const updateTransaction = useCallback((month: string, accountId: string, transactionId: string, updates: Partial<Omit<Transaction, 'id'>>) => {
        setFinancials(prev => {
            if (!prev) return null;
            const monthTransactions = prev.transactionData[month]?.[accountId] || [];
            const updatedTransactions = monthTransactions.map(t =>
                t.id === transactionId ? { ...t, ...updates } : t
            );
            return {
                ...prev,
                transactionData: {
                    ...prev.transactionData,
                    [month]: {
                        ...(prev.transactionData[month] || {}),
                        [accountId]: updatedTransactions,
                    },
                }
            };
        });
    }, []);

    const addFixedCostLedgerItem = useCallback((item: Omit<FixedCostLedgerItem, 'id'>) => {
        const newItem: FixedCostLedgerItem = { ...item, id: `fcl-${Date.now()}` };
        setFinancials(prev => prev ? { ...prev, fixedCostLedger: [...prev.fixedCostLedger, newItem] } : null);
    }, []);

    const updateFixedCostLedgerItem = useCallback((itemId: string, updates: Partial<FixedCostLedgerItem>) => {
        setFinancials(prev => prev ? { ...prev, fixedCostLedger: prev.fixedCostLedger.map(item => item.id === itemId ? { ...item, ...updates } : item) } : null);
    }, []);

    const removeFixedCostLedgerItem = useCallback((itemId: string) => {
        setFinancials(prev => prev ? { ...prev, fixedCostLedger: prev.fixedCostLedger.filter(item => item.id !== itemId) } : null);
    }, []);
    
    const addAccountGroup = useCallback((groupName: string, type: 'revenue' | 'cogs' | 'sga') => {
        setFinancials(prev => {
            if (!prev || !groupName.trim() || prev.accountGroups[type].includes(groupName.trim())) return prev;
            return {
                ...prev,
                accountGroups: {
                    ...prev.accountGroups,
                    [type]: [...prev.accountGroups[type], groupName.trim()],
                }
            };
        });
    }, []);
    
    const removeAccountGroup = useCallback((groupName: string, type: 'revenue' | 'cogs' | 'sga') => {
        setFinancials(prev => {
            if (!prev) return null;
            const currentAllAccounts = [
                ...prev.accounts.revenue, ...prev.accounts.cogs, 
                ...prev.accounts.sgaFixed, ...prev.accounts.sgaVariable
            ];
            if (currentAllAccounts.some(acc => acc.group === groupName)) {
                console.error('Cannot delete group with accounts.');
                return prev;
            }
            return {
                ...prev,
                accountGroups: {
                    ...prev.accountGroups,
                    [type]: prev.accountGroups[type].filter(g => g !== groupName)
                }
            };
        });
    }, []);

    const updateGroupName = useCallback((oldName: string, newName: string, type: 'revenue' | 'cogs' | 'sga') => {
        if (!newName || oldName === newName) return;

        setFinancials(prev => {
            if (!prev) return null;
            const newFin = { ...prev };
            
            newFin.accountGroups = {
                ...prev.accountGroups,
                [type]: prev.accountGroups[type].map(g => g === oldName ? newName : g)
            };

            const updateAccountsForGroup = (accs: Account[]) => accs.map(acc => acc.group === oldName ? { ...acc, group: newName } : acc);

            let accountsToUpdate: Partial<typeof prev.accounts> = {};
            if (type === 'revenue') {
                accountsToUpdate.revenue = updateAccountsForGroup(prev.accounts.revenue);
            } else if (type === 'cogs') {
                accountsToUpdate.cogs = updateAccountsForGroup(prev.accounts.cogs);
            } else if (type === 'sga') {
                accountsToUpdate.sgaFixed = updateAccountsForGroup(prev.accounts.sgaFixed);
                accountsToUpdate.sgaVariable = updateAccountsForGroup(prev.accounts.sgaVariable);
            }
            newFin.accounts = { ...prev.accounts, ...accountsToUpdate };

            return newFin;
        });
    }, []);


    const accountValues = useMemo(() => {
        const result: { [month: string]: { [accountId: string]: number } } = {};
        
        for (const month of allAvailableMonths) {
            result[month] = {};
            for (const acc of allAccounts) {
                if (acc.entryType === 'transaction') {
                    const transactions = transactionData[month]?.[acc.id] || [];
                    result[month][acc.id] = transactions.reduce((sum, t) => sum + t.amount, 0);
                } else { // manual entry
                    const ledgerItem = fixedCostLedger.find(item => item.accountId === acc.id);
                    result[month][acc.id] = manualData[month]?.[acc.id] ?? (ledgerItem?.monthlyCost || 0);
                }
            }
        }
        return result;
    }, [allAccounts, transactionData, manualData, fixedCostLedger, allAvailableMonths]);
    
    const calculatedData = useMemo(() => {
        const result: { [month: string]: CalculatedMonthData } = {};
        
        for (const month of allAvailableMonths) {
            const monthAccountValues = accountValues[month] || {};
            const getVal = (acc: Account) => monthAccountValues[acc.id] || 0;

            const revenue = accounts.revenue.reduce((sum, acc) => sum + getVal(acc), 0);
            const cogs = accounts.cogs.reduce((sum, acc) => sum + getVal(acc), 0);
            const grossProfit = revenue - cogs;
            const cogsRatio = revenue === 0 ? 0 : (cogs / revenue) * 100;
            
            const sgaFixed = accounts.sgaFixed.reduce((sum, acc) => sum + getVal(acc), 0);
            const sgaVariable = accounts.sgaVariable.reduce((sum, acc) => sum + getVal(acc), 0);
            const totalSga = sgaFixed + sgaVariable;
            
            const operatingProfit = grossProfit - totalSga;

            const groupSubtotals: { [groupName: string]: number } = {};
            allAccounts.forEach(acc => {
                if(acc.group) {
                    if(!groupSubtotals[acc.group]) groupSubtotals[acc.group] = 0;
                    groupSubtotals[acc.group] += getVal(acc);
                }
            });

            result[month] = {
                revenue,
                cogs,
                grossProfit,
                cogsRatio,
                sgaFixed,
                sgaVariable,
                totalSga,
                operatingProfit,
                groupSubtotals,
            };
        }
        return result;
    }, [accounts, accountValues, allAvailableMonths, allAccounts]);

    return useMemo(() => ({
        accounts,
        allAccounts,
        accountGroups,
        transactionData,
        manualData,
        fixedCostLedger,
        accountValues,
        calculatedData,
        addAccount,
        removeAccount,
        updateAccount,
        updateManualAccountValue,
        setTransactionAccountTotal,
        addTransaction,
        removeTransaction,
        updateTransaction,
        addFixedCostLedgerItem,
        updateFixedCostLedgerItem,
        removeFixedCostLedgerItem,
        updateGroupName,
        addAccountGroup,
        removeAccountGroup
    }), [
        accounts,
        allAccounts,
        accountGroups,
        transactionData,
        manualData,
        fixedCostLedger,
        accountValues,
        calculatedData,
        addAccount,
        removeAccount,
        updateAccount,
        updateManualAccountValue,
        setTransactionAccountTotal,
        addTransaction,
        removeTransaction,
        updateTransaction,
        addFixedCostLedgerItem,
        updateFixedCostLedgerItem,
        removeFixedCostLedgerItem,
        updateGroupName,
        addAccountGroup,
        removeAccountGroup
    ]);
};

export default useFinancialData;