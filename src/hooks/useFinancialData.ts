import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Account,
  AccountCategory,
  FixedCostActual,
  FixedCostTemplate,
  FixedCostType,
  IncomeStatementState,
  MonthlyAccountOverrides,
  Transaction,
  UseFinancialDataReturn,
  VariableAccountsState,
  FixedCostsState,
} from '../types';
import DatabaseService from '../services/DatabaseService';

const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const COST_TYPE_GROUP: Record<FixedCostType, string> = {
  ASSET_FINANCE: '리스/금융 자산',
  OPERATING_SERVICE: '운영 서비스 계약',
};

const useFinancialData = (tenantId: string | undefined): UseFinancialDataReturn | null => {
  const [financials, setFinancials] = useState(tenantId ? DatabaseService.getFinancials(tenantId) : null);

  useEffect(() => {
    if (tenantId) {
      setFinancials(DatabaseService.getFinancials(tenantId));
    }
  }, [tenantId]);

  useEffect(() => {
    if (tenantId && financials) {
      DatabaseService.saveFinancials(tenantId, financials);
    }
  }, [tenantId, financials]);

  if (!financials) {
    return null;
  }

  const {
    accounts,
    accountGroups,
    transactionData,
    manualData,
    monthlyOverrides = {},
  } = financials;

  const fixedCostTemplates = financials.fixedCostTemplates ?? [];
  const fixedCostActuals = financials.fixedCostActuals ?? [];

  const allAccounts = useMemo(() => (
    [
      ...accounts.revenue,
      ...accounts.cogs,
      ...accounts.sgaFixed,
      ...accounts.sgaVariable,
    ]
  ), [accounts]);

  const allAvailableMonths = useMemo(() => {
    const months = new Set<string>();
    Object.keys(transactionData).forEach(month => months.add(month));
    Object.keys(manualData).forEach(month => months.add(month));
    fixedCostActuals.forEach(actual => months.add(actual.month));
    Object.keys(monthlyOverrides).forEach(month => months.add(month));
    return Array.from(months).sort();
  }, [transactionData, manualData, fixedCostActuals, monthlyOverrides]);

  const fixedCostValueByMonth = useMemo(() => {
    const map: { [month: string]: { [accountId: string]: number } } = {};
    fixedCostActuals.forEach(actual => {
      if (!actual.isActive) return;
      const template = fixedCostTemplates.find(t => t.id === actual.templateId);
      if (!template) return;
      if (!map[actual.month]) {
        map[actual.month] = {};
      }
      map[actual.month][template.accountId] = (map[actual.month][template.accountId] || 0) + actual.amount;
    });
    return map;
  }, [fixedCostActuals, fixedCostTemplates]);

  const accountValues = useMemo(() => {
    const result: { [month: string]: { [accountId: string]: number } } = {};

    for (const month of allAvailableMonths) {
      const override = monthlyOverrides[month] || { addedAccounts: [] };
      const addedAccounts = override.addedAccounts || [];

      result[month] = {};

      for (const acc of allAccounts) {
        let value = 0;
        if (acc.entryType === 'transaction') {
          const transactions = transactionData[month]?.[acc.id] || [];
          value = transactions.reduce((sum, t) => sum + t.amount, 0);
        } else if (acc.category === AccountCategory.SGA_FIXED) {
          value = fixedCostValueByMonth[month]?.[acc.id] || 0;
        } else {
          value = manualData[month]?.[acc.id] ?? 0;
        }

        result[month][acc.id] = value;
      }

      for (const tempAcc of addedAccounts) {
        let value = 0;
        if (tempAcc.entryType === 'transaction') {
          const transactions = transactionData[month]?.[tempAcc.id] || [];
          value = transactions.reduce((sum, t) => sum + t.amount, 0);
        } else if (tempAcc.category === AccountCategory.SGA_FIXED) {
          value = fixedCostValueByMonth[month]?.[tempAcc.id] || 0;
        } else {
          value = manualData[month]?.[tempAcc.id] ?? 0;
        }

        result[month][tempAcc.id] = value;
      }
    }

    return result;
  }, [allAccounts, allAvailableMonths, transactionData, manualData, fixedCostValueByMonth, monthlyOverrides]);

  const calculatedData = useMemo(() => {
    const result: IncomeStatementState['calculatedData'] = {};

    for (const month of allAvailableMonths) {
      const override = monthlyOverrides[month] || { addedAccounts: [] };
      const addedAccounts = override.addedAccounts || [];
      const monthAccountValues = accountValues[month] || {};
      const getValById = (accountId: string) => monthAccountValues[accountId] || 0;

      const revenue = accounts.revenue.reduce((sum, acc) => sum + getValById(acc.id), 0)
        + addedAccounts
          .filter(acc => acc.category === AccountCategory.REVENUE)
          .reduce((sum, acc) => sum + getValById(acc.id), 0);

      const cogs = accounts.cogs.reduce((sum, acc) => sum + getValById(acc.id), 0)
        + addedAccounts
          .filter(acc => acc.category === AccountCategory.COGS)
          .reduce((sum, acc) => sum + getValById(acc.id), 0);

      const sgaFixed = accounts.sgaFixed.reduce((sum, acc) => sum + getValById(acc.id), 0)
        + addedAccounts
          .filter(acc => acc.category === AccountCategory.SGA_FIXED)
          .reduce((sum, acc) => sum + getValById(acc.id), 0);

      const sgaVariable = accounts.sgaVariable.reduce((sum, acc) => sum + getValById(acc.id), 0)
        + addedAccounts
          .filter(acc => acc.category === AccountCategory.SGA_VARIABLE)
          .reduce((sum, acc) => sum + getValById(acc.id), 0);

      const totalSga = sgaFixed + sgaVariable;
      const grossProfit = revenue - cogs;
      const cogsRatio = revenue === 0 ? 0 : (cogs / revenue) * 100;
      const operatingProfit = grossProfit - totalSga;

      const groupSubtotals: { [groupName: string]: number } = {};
      [...allAccounts, ...addedAccounts].forEach(acc => {
        if (!acc.group) return;
        if (!groupSubtotals[acc.group]) {
          groupSubtotals[acc.group] = 0;
        }
        groupSubtotals[acc.group] += getValById(acc.id);
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
  }, [accounts, accountValues, allAccounts, allAvailableMonths, monthlyOverrides]);

  const saveVariableStructure = useCallback((payload: {
    accounts: {
      revenue: Account[];
      cogs: Account[];
      sgaVariable: Account[];
    };
    accountGroups: typeof accountGroups;
  }) => {
    setFinancials(prev => {
      if (!prev) return null;

      const { accounts: nextAccountsInput, accountGroups: nextGroups } = payload;
      const buildNextCategory = (key: 'revenue' | 'cogs' | 'sgaVariable') => {
        const previousList = prev.accounts[key];
        const incomingList = nextAccountsInput[key];
        const incomingMap = new Map(incomingList.map(acc => [acc.id, acc]));

        const result: Account[] = [];

        previousList.forEach(acc => {
          if (incomingMap.has(acc.id)) {
            const incoming = incomingMap.get(acc.id)!;
            result.push({ ...acc, ...incoming, isArchived: false });
            incomingMap.delete(acc.id);
          } else {
            result.push({ ...acc, isArchived: true });
          }
        });

        incomingMap.forEach(acc => {
          result.push({ ...acc, isArchived: false });
        });

        return result;
      };

      const nextRevenue = buildNextCategory('revenue');
      const nextCogs = buildNextCategory('cogs');
      const nextSgaVariable = buildNextCategory('sgaVariable');

      return {
        ...prev,
        accounts: {
          ...prev.accounts,
          revenue: nextRevenue,
          cogs: nextCogs,
          sgaVariable: nextSgaVariable,
        },
        accountGroups: nextGroups,
      };
    });
  }, []);

  const addAccount = useCallback((name: string, category: AccountCategory, group: string) => {
    const newAccount: Account = {
      id: `${category.toLowerCase()}-${Date.now()}`,
      name,
      category,
      group,
      isDeletable: true,
      entryType: category === AccountCategory.SGA_FIXED ? 'manual' : 'transaction',
    };

    setFinancials(prev => {
      if (!prev) return null;
      const nextAccounts = { ...prev.accounts };

      if (category === AccountCategory.REVENUE) nextAccounts.revenue = [...prev.accounts.revenue, newAccount];
      if (category === AccountCategory.COGS) nextAccounts.cogs = [...prev.accounts.cogs, newAccount];
      if (category === AccountCategory.SGA_FIXED) nextAccounts.sgaFixed = [...prev.accounts.sgaFixed, newAccount];
      if (category === AccountCategory.SGA_VARIABLE) nextAccounts.sgaVariable = [...prev.accounts.sgaVariable, newAccount];

      return {
        ...prev,
        accounts: nextAccounts,
      };
    });
  }, []);

  const removeAccount = useCallback((id: string, category: AccountCategory) => {
    setFinancials(prev => {
      if (!prev) return null;

      const nextAccounts = { ...prev.accounts };
      if (category === AccountCategory.REVENUE) nextAccounts.revenue = prev.accounts.revenue.filter(acc => acc.id !== id);
      if (category === AccountCategory.COGS) nextAccounts.cogs = prev.accounts.cogs.filter(acc => acc.id !== id);
      if (category === AccountCategory.SGA_FIXED) nextAccounts.sgaFixed = prev.accounts.sgaFixed.filter(acc => acc.id !== id);
      if (category === AccountCategory.SGA_VARIABLE) nextAccounts.sgaVariable = prev.accounts.sgaVariable.filter(acc => acc.id !== id);

      const cleanupData = (data: typeof prev.manualData | typeof prev.transactionData) => {
        const nextData: Record<string, any> = {};
        Object.entries(data).forEach(([month, monthData]) => {
          const { [id]: _removed, ...rest } = monthData;
          nextData[month] = rest;
        });
        return nextData;
      };

      const nextManual = cleanupData(prev.manualData as any);
      const nextTransactions = cleanupData(prev.transactionData as any);

      let nextTemplates = prev.fixedCostTemplates ?? [];
      let nextActuals = prev.fixedCostActuals ?? [];
      if (category === AccountCategory.SGA_FIXED) {
        const targetTemplateIds = (prev.fixedCostTemplates ?? []).filter(template => template.accountId === id).map(template => template.id);
        nextTemplates = (prev.fixedCostTemplates ?? []).filter(template => template.accountId !== id);
        nextActuals = (prev.fixedCostActuals ?? []).filter(actual => !targetTemplateIds.includes(actual.templateId));
      }

      return {
        ...prev,
        accounts: nextAccounts,
        manualData: nextManual,
        transactionData: nextTransactions,
        fixedCostTemplates: nextTemplates,
        fixedCostActuals: nextActuals,
      };
    });
  }, []);

  const updateAccount = useCallback((accountId: string, updates: Partial<Pick<Account, 'name' | 'group'>>) => {
    setFinancials(prev => {
      if (!prev) return null;

      const apply = (accs: Account[]) => accs.map(acc => (
        acc.id === accountId ? { ...acc, ...updates } : acc
      ));

      const nextAccounts = {
        revenue: apply(prev.accounts.revenue),
        cogs: apply(prev.accounts.cogs),
        sgaFixed: apply(prev.accounts.sgaFixed),
        sgaVariable: apply(prev.accounts.sgaVariable),
      };

      const renamedAccount = nextAccounts.sgaFixed.find(acc => acc.id === accountId);
      const shouldSyncTemplateName = updates.name && renamedAccount && renamedAccount.category === AccountCategory.SGA_FIXED;
      const templatesSource = prev.fixedCostTemplates ?? [];
      const nextTemplates = shouldSyncTemplateName
        ? templatesSource.map(template => (
            template.accountId === accountId
              ? { ...template, serviceName: updates.name as string }
              : template
          ))
        : templatesSource;

      return {
        ...prev,
        accounts: nextAccounts,
        fixedCostTemplates: nextTemplates,
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
        },
      };
    });
  }, []);

  const setTransactionAccountTotal = useCallback((month: string, accountId: string, totalAmount: number, accountName: string) => {
    const newTransaction: Transaction = {
      id: createId('t'),
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
        },
      };
    });
  }, []);

  const addTransaction = useCallback((month: string, accountId: string, transaction: Omit<Transaction, 'id'>) => {
    const newTransaction: Transaction = { ...transaction, id: createId('t') };

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
        },
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
        },
      };
    });
  }, []);

  const updateTransaction = useCallback((month: string, accountId: string, transactionId: string, updates: Partial<Omit<Transaction, 'id'>>) => {
    setFinancials(prev => {
      if (!prev) return null;
      const monthTransactions = prev.transactionData[month]?.[accountId] || [];
      const updated = monthTransactions.map(transaction => (
        transaction.id === transactionId ? { ...transaction, ...updates } : transaction
      ));

      return {
        ...prev,
        transactionData: {
          ...prev.transactionData,
          [month]: {
            ...(prev.transactionData[month] || {}),
            [accountId]: updated,
          },
        },
      };
    });
  }, []);

  const addAccountGroup = useCallback((groupName: string, type: 'revenue' | 'cogs' | 'sga') => {
    setFinancials(prev => {
      if (!prev || !groupName.trim() || prev.accountGroups[type].includes(groupName.trim())) return prev;

      return {
        ...prev,
        accountGroups: {
          ...prev.accountGroups,
          [type]: [...prev.accountGroups[type], groupName.trim()],
        },
      };
    });
  }, []);

  const removeAccountGroup = useCallback((groupName: string, type: 'revenue' | 'cogs' | 'sga') => {
    setFinancials(prev => {
      if (!prev) return null;
      const hasMembers = [
        ...prev.accounts.revenue,
        ...prev.accounts.cogs,
        ...prev.accounts.sgaFixed,
        ...prev.accounts.sgaVariable,
      ].some(acc => acc.group === groupName);

      if (hasMembers) {
        console.error('Cannot delete group with accounts.');
        return prev;
      }

      return {
        ...prev,
        accountGroups: {
          ...prev.accountGroups,
          [type]: prev.accountGroups[type].filter(group => group !== groupName),
        },
      };
    });
  }, []);

  const updateGroupName = useCallback((oldName: string, newName: string, type: 'revenue' | 'cogs' | 'sga') => {
    if (!newName || oldName === newName) return;

    setFinancials(prev => {
      if (!prev) return null;

      const renameGroup = (groups: string[]) => groups.map(group => (group === oldName ? newName : group));
      const renameAccounts = (accs: Account[]) => accs.map(acc => (
        acc.group === oldName ? { ...acc, group: newName } : acc
      ));

      const nextGroups = {
        ...prev.accountGroups,
        [type]: renameGroup(prev.accountGroups[type]),
      };

      const nextAccounts = {
        revenue: type === 'revenue' ? renameAccounts(prev.accounts.revenue) : prev.accounts.revenue,
        cogs: type === 'cogs' ? renameAccounts(prev.accounts.cogs) : prev.accounts.cogs,
        sgaFixed: type === 'sga' ? renameAccounts(prev.accounts.sgaFixed) : prev.accounts.sgaFixed,
        sgaVariable: type === 'sga' ? renameAccounts(prev.accounts.sgaVariable) : prev.accounts.sgaVariable,
      };

      return {
        ...prev,
        accountGroups: nextGroups,
        accounts: nextAccounts,
      };
    });
  }, []);

  const addFixedCostTemplate = useCallback((template: Omit<FixedCostTemplate, 'id'>) => {
    const newTemplate: FixedCostTemplate = {
      ...template,
      id: createId('fct'),
    };

    setFinancials(prev => prev ? {
      ...prev,
      fixedCostTemplates: [...(prev.fixedCostTemplates ?? []), newTemplate],
    } : prev);

    return newTemplate.id;
  }, []);

  const updateFixedCostTemplate = useCallback((itemId: string, updates: Partial<FixedCostTemplate>) => {
    setFinancials(prev => prev ? {
      ...prev,
      fixedCostTemplates: (prev.fixedCostTemplates ?? []).map(template => (
        template.id === itemId ? { ...template, ...updates } : template
      )),
    } : null);
  }, []);

  const removeFixedCostTemplate = useCallback((itemId: string) => {
    setFinancials(prev => {
      if (!prev) return null;
      return {
        ...prev,
        fixedCostTemplates: (prev.fixedCostTemplates ?? []).filter(template => template.id !== itemId),
        fixedCostActuals: (prev.fixedCostActuals ?? []).filter(actual => actual.templateId !== itemId),
      };
    });
  }, []);

  const upsertFixedCostActual = useCallback((month: string, templateId: string, payload: { amount?: number; isActive?: boolean }) => {
    setFinancials(prev => {
      if (!prev) return null;

      const existingActuals = prev.fixedCostActuals ?? [];
      const existingTemplates = prev.fixedCostTemplates ?? [];

      const existingIndex = existingActuals.findIndex(actual => actual.month === month && actual.templateId === templateId);
      const template = existingTemplates.find(item => item.id === templateId);
      const defaultAmount = template?.monthlyCost ?? 0;
      const nextActuals = [...existingActuals];

      if (existingIndex >= 0) {
        const current = nextActuals[existingIndex];
        nextActuals[existingIndex] = {
          ...current,
          amount: payload.amount ?? current.amount,
          isActive: payload.isActive ?? current.isActive,
        };
      } else {
        nextActuals.push({
          id: createId('fca'),
          templateId,
          month,
          amount: payload.amount ?? defaultAmount,
          isActive: payload.isActive ?? true,
        });
      }

      return {
        ...prev,
        fixedCostActuals: nextActuals,
      };
    });
  }, []);

  const removeFixedCostActual = useCallback((month: string, templateId: string) => {
    setFinancials(prev => prev ? {
      ...prev,
      fixedCostActuals: (prev.fixedCostActuals ?? []).filter(actual => !(actual.month === month && actual.templateId === templateId)),
    } : null);
  }, []);

  const createFixedAccount = useCallback((name: string, costType: FixedCostType) => {
    const trimmedName = name.trim();
    const account: Account = {
      id: createId('sga-fix'),
      name: trimmedName,
      category: AccountCategory.SGA_FIXED,
      group: COST_TYPE_GROUP[costType],
      isDeletable: true,
      entryType: 'manual',
    };

    setFinancials(prev => {
      if (!prev) return null;
      return {
        ...prev,
        accounts: {
          ...prev.accounts,
          sgaFixed: [...prev.accounts.sgaFixed, account],
        },
      };
    });

    return account.id;
  }, []);

  const addMonthlyAccount = useCallback((month: string, payload: { name: string; category: AccountCategory; group: string; entryType?: 'manual' | 'transaction' }) => {
    const trimmedName = payload.name.trim();
    if (!month || !trimmedName) {
      return '';
    }

    const allowedCategories = [AccountCategory.REVENUE, AccountCategory.COGS, AccountCategory.SGA_VARIABLE];
    if (!allowedCategories.includes(payload.category)) {
      return '';
    }

    const newAccount: Account = {
      id: createId(`temp-${payload.category.toLowerCase()}`),
      name: trimmedName,
      category: payload.category,
      group: payload.group,
      isDeletable: true,
      entryType: payload.entryType || 'transaction',
      isTemporary: true,
    };

    setFinancials(prev => {
      if (!prev) return null;

      const overrides = prev.monthlyOverrides || {};
      const baseOverride = overrides[month] || { addedAccounts: [] };

      return {
        ...prev,
        monthlyOverrides: {
          ...overrides,
          [month]: {
            addedAccounts: [...baseOverride.addedAccounts, newAccount],
          },
        },
      };
    });

    return newAccount.id;
  }, []);

  const updateMonthlyAccount = useCallback((month: string, accountId: string, updates: Partial<Pick<Account, 'name'>>) => {
    setFinancials(prev => {
      if (!prev) return null;

      const overrides = prev.monthlyOverrides || {};
      const override = overrides[month];
      if (!override) return prev;

      return {
        ...prev,
        monthlyOverrides: {
          ...overrides,
          [month]: {
            ...override,
            addedAccounts: override.addedAccounts.map(acc => (
              acc.id === accountId ? { ...acc, ...updates } : acc
            )),
          },
        },
      };
    });
  }, []);

  const removeMonthlyAccount = useCallback((month: string, accountId: string) => {
    setFinancials(prev => {
      if (!prev) return null;

      const overrides = prev.monthlyOverrides || {};
      const override = overrides[month];
      if (!override) return prev;

      const nextOverrides: MonthlyAccountOverrides = {
        ...overrides,
        [month]: {
          ...override,
          addedAccounts: override.addedAccounts.filter(acc => acc.id !== accountId),
        },
      };

      const nextManual = { ...prev.manualData };
      if (nextManual[month]) {
        const { [accountId]: _removed, ...rest } = nextManual[month];
        nextManual[month] = rest;
      }

      const nextTransactions = { ...prev.transactionData };
      if (nextTransactions[month]) {
        const { [accountId]: _removed, ...rest } = nextTransactions[month];
        nextTransactions[month] = rest as any;
      }

      return {
        ...prev,
        manualData: nextManual,
        transactionData: nextTransactions,
        monthlyOverrides: nextOverrides,
      };
    });
  }, []);

  const variableState: VariableAccountsState = useMemo(() => ({
    accounts: {
      revenue: accounts.revenue.filter(acc => !acc.isArchived),
      cogs: accounts.cogs.filter(acc => !acc.isArchived),
      sgaVariable: accounts.sgaVariable.filter(acc => !acc.isArchived),
    },
    accountGroups,
    transactionData,
    manualData,
    saveStructure: saveVariableStructure,
    addAccount,
    removeAccount,
    updateAccount,
    updateManualAccountValue,
    setTransactionAccountTotal,
    addTransaction,
    removeTransaction,
    updateTransaction,
    updateGroupName,
    addAccountGroup,
    removeAccountGroup,
  }), [
    accounts.revenue,
    accounts.cogs,
    accounts.sgaVariable,
    accountGroups,
    transactionData,
    manualData,
    saveVariableStructure,
    addAccount,
    removeAccount,
    updateAccount,
    updateManualAccountValue,
    setTransactionAccountTotal,
    addTransaction,
    removeTransaction,
    updateTransaction,
    updateGroupName,
    addAccountGroup,
    removeAccountGroup,
  ]);

  const fixedState: FixedCostsState = useMemo(() => ({
    accounts: accounts.sgaFixed,
    templates: fixedCostTemplates,
    actuals: fixedCostActuals,
    addTemplate: addFixedCostTemplate,
    updateTemplate: updateFixedCostTemplate,
    removeTemplate: removeFixedCostTemplate,
    upsertActual: upsertFixedCostActual,
    removeActual: removeFixedCostActual,
    updateAccount,
    createAccount: createFixedAccount,
  }), [
    accounts.sgaFixed,
    fixedCostTemplates,
    fixedCostActuals,
    addFixedCostTemplate,
    updateFixedCostTemplate,
    removeFixedCostTemplate,
    upsertFixedCostActual,
    removeFixedCostActual,
    updateAccount,
    createFixedAccount,
  ]);

  const statementState: IncomeStatementState = useMemo(() => ({
    accounts,
    accountValues,
    calculatedData,
    availableMonths: allAvailableMonths,
    fixedCostActuals,
    monthlyOverrides,
    addMonthlyAccount,
    updateMonthlyAccount,
    removeMonthlyAccount,
  }), [
    accounts,
    accountValues,
    calculatedData,
    allAvailableMonths,
    fixedCostActuals,
    monthlyOverrides,
    addMonthlyAccount,
    updateMonthlyAccount,
    removeMonthlyAccount,
  ]);

  return useMemo(() => ({
    variable: variableState,
    fixed: fixedState,
    statement: statementState,
  }), [variableState, fixedState, statementState]);
};

export default useFinancialData;
