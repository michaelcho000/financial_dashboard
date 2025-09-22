import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Account,
  AccountCategory,
  AccountGroups,
  CalculatedMonthData,
  CostBehavior,
  Financials,
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

const LEGACY_COST_BEHAVIOR_MAP: Record<string, CostBehavior> = {
  COGS: 'variable',
  SGA_VARIABLE: 'variable',
  SGA_FIXED: 'fixed',
};

const LEGACY_EXPENSE_CATEGORIES = new Set(Object.keys(LEGACY_COST_BEHAVIOR_MAP));

const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const COST_TYPE_GROUP: Record<FixedCostType, string> = {
  ASSET_FINANCE: '리스/금융 자산',
  OPERATING_SERVICE: '운영 서비스 계약',
};

const normalizeAccount = (raw: any): Account => {
  if (!raw) {
    throw new Error('Invalid account data');
  }

  const legacyCategory = typeof raw.category === 'string' ? raw.category : undefined;
  let category: AccountCategory = AccountCategory.REVENUE;
  let costBehavior: CostBehavior | undefined;
  let entryType: 'manual' | 'transaction' = raw.entryType === 'manual' ? 'manual' : 'transaction';

  if (legacyCategory === AccountCategory.REVENUE) {
    category = AccountCategory.REVENUE;
    costBehavior = undefined;
    entryType = 'transaction';
  } else if (legacyCategory === AccountCategory.EXPENSE) {
    category = AccountCategory.EXPENSE;
    costBehavior = raw.costBehavior === 'fixed' ? 'fixed' : 'variable';
    entryType = costBehavior === 'fixed' ? 'manual' : 'transaction';
  } else if (legacyCategory && LEGACY_EXPENSE_CATEGORIES.has(legacyCategory)) {
    category = AccountCategory.EXPENSE;
    costBehavior = LEGACY_COST_BEHAVIOR_MAP[legacyCategory] ?? 'variable';
    entryType = costBehavior === 'fixed' ? 'manual' : 'transaction';
  } else {
    // fallback: treat as revenue
    category = AccountCategory.REVENUE;
    costBehavior = undefined;
    entryType = 'transaction';
  }

  return {
    id: String(raw.id ?? createId('acct')),
    name: String(raw.name ?? '미정'),
    category,
    costBehavior,
    group: raw.group ?? undefined,
    isDeletable: raw.isDeletable !== false,
    entryType,
    isTemporary: raw.isTemporary ?? false,
    isArchived: raw.isArchived ?? false,
  };
};

const normalizeAccountArray = (items: any[] | undefined): Account[] => (
  Array.isArray(items) ? items.map(normalizeAccount) : []
);

const mergeUniqueStrings = (...arrays: (string[] | undefined)[]): string[] => {
  const set = new Set<string>();
  arrays.forEach(list => {
    (list ?? []).forEach(item => {
      if (item && item.trim()) {
        set.add(item.trim());
      }
    });
  });
  return Array.from(set);
};

const normalizeMonthlyOverrides = (overrides: MonthlyAccountOverrides | undefined): MonthlyAccountOverrides => {
  if (!overrides) {
    return {};
  }

  const normalized: MonthlyAccountOverrides = {};
  Object.entries(overrides).forEach(([month, value]) => {
    if (!value) return;
    normalized[month] = {
      addedAccounts: normalizeAccountArray(value.addedAccounts),
    };
  });
  return normalized;
};

const normalizeFinancials = (raw: any): Financials => {
  if (!raw) {
    return {
      templateVersion: undefined,
      accounts: {
        revenue: [],
        expense: [],
      },
      accountGroups: {
        revenue: [],
        expense: [],
      },
      transactionData: {},
      manualData: {},
      fixedCostTemplates: [],
      fixedCostActuals: [],
      monthlyOverrides: {},
    };
  }

  const revenueAccounts = normalizeAccountArray(raw.accounts?.revenue);

  let expenseAccounts: Account[] = [];
  if (Array.isArray(raw.accounts?.expense)) {
    expenseAccounts = normalizeAccountArray(raw.accounts?.expense)
      .map(account => ({
        ...account,
        category: AccountCategory.EXPENSE,
        costBehavior: account.costBehavior === 'fixed' ? 'fixed' : 'variable',
        entryType: account.costBehavior === 'fixed' ? 'manual' : 'transaction',
      }));
  } else {
    const legacyExpense = [
      ...(raw.accounts?.cogs ?? []),
      ...(raw.accounts?.sgaFixed ?? []),
      ...(raw.accounts?.sgaVariable ?? []),
    ];
    expenseAccounts = normalizeAccountArray(legacyExpense);
  }

  const accountGroups: AccountGroups = {
    revenue: mergeUniqueStrings(raw.accountGroups?.revenue),
    expense: Array.isArray(raw.accountGroups?.expense)
      ? mergeUniqueStrings(raw.accountGroups?.expense)
      : mergeUniqueStrings(raw.accountGroups?.cogs, raw.accountGroups?.sga),
  };

  return {
    templateVersion: raw.templateVersion,
    accounts: {
      revenue: revenueAccounts,
      expense: expenseAccounts,
    },
    accountGroups,
    transactionData: raw.transactionData ?? {},
    manualData: raw.manualData ?? {},
    fixedCostTemplates: raw.fixedCostTemplates ?? [],
    fixedCostActuals: raw.fixedCostActuals ?? [],
    monthlyOverrides: normalizeMonthlyOverrides(raw.monthlyOverrides),
  };
};

const useFinancialData = (tenantId: string | undefined): UseFinancialDataReturn | null => {
  const [financials, setFinancials] = useState<Financials | null>(tenantId ? normalizeFinancials(DatabaseService.getFinancials(tenantId)) : null);

  useEffect(() => {
    if (tenantId) {
      const raw = DatabaseService.getFinancials(tenantId);
      setFinancials(normalizeFinancials(raw));
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
    fixedCostTemplates = [],
    fixedCostActuals = [],
  } = financials;

  const allAccounts = useMemo(() => (
    [
      ...accounts.revenue,
      ...accounts.expense,
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

      const computeValue = (acc: Account) => {
        if (acc.entryType === 'transaction') {
          const transactions = transactionData[month]?.[acc.id] || [];
          return transactions.reduce((sum, t) => sum + t.amount, 0);
        }
        if (acc.category === AccountCategory.EXPENSE && acc.costBehavior === 'fixed') {
          const fixedValue = fixedCostValueByMonth[month]?.[acc.id];
          if (typeof fixedValue === 'number') {
            return fixedValue;
          }
        }
        return manualData[month]?.[acc.id] ?? 0;
      };

      allAccounts.forEach(acc => {
        result[month][acc.id] = computeValue(acc);
      });

      addedAccounts.forEach(acc => {
        result[month][acc.id] = computeValue(acc);
      });
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

      const totalRevenue = accounts.revenue.reduce((sum, acc) => sum + getValById(acc.id), 0)
        + addedAccounts
          .filter(acc => acc.category === AccountCategory.REVENUE)
          .reduce((sum, acc) => sum + getValById(acc.id), 0);

      let variableExpense = 0;
      let fixedExpense = 0;

      const expenseCandidates = accounts.expense.concat(addedAccounts.filter(acc => acc.category === AccountCategory.EXPENSE));
      expenseCandidates.forEach(acc => {
        const value = getValById(acc.id);
        if (acc.costBehavior === 'fixed') {
          fixedExpense += value;
        } else {
          variableExpense += value;
        }
      });

      const totalExpense = variableExpense + fixedExpense;
      const operatingIncome = totalRevenue - totalExpense;

      const groupSubtotals: CalculatedMonthData['groupSubtotals'] = {};
      [...allAccounts, ...addedAccounts].forEach(acc => {
        if (!acc.group) return;
        if (!groupSubtotals[acc.group]) {
          groupSubtotals[acc.group] = 0;
        }
        groupSubtotals[acc.group] += getValById(acc.id);
      });

      result[month] = {
        totalRevenue,
        variableExpense,
        fixedExpense,
        totalExpense,
        operatingIncome,
        groupSubtotals,
      };
    }

    return result;
  }, [accounts, accountValues, allAccounts, allAvailableMonths, monthlyOverrides]);

  const saveVariableStructure = useCallback((payload: {
    accounts: {
      revenue: Account[];
      expense: Account[];
    };
    accountGroups: AccountGroups;
  }) => {
    setFinancials(prev => {
      if (!prev) return null;

      const mergeAccounts = (previousList: Account[], incomingList: Account[]) => {
        const incomingMap = new Map(incomingList.map(acc => [acc.id, normalizeAccount(acc)]));
        const result: Account[] = [];

        previousList.forEach(acc => {
          if (incomingMap.has(acc.id)) {
            const next = incomingMap.get(acc.id)!;
            result.push({ ...acc, ...next, isArchived: false });
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

      return {
        ...prev,
        accounts: {
          revenue: mergeAccounts(prev.accounts.revenue, payload.accounts.revenue),
          expense: mergeAccounts(prev.accounts.expense, payload.accounts.expense),
        },
        accountGroups: payload.accountGroups,
      };
    });
  }, []);

  const addAccount = useCallback((payload: { name: string; category: AccountCategory; group: string; costBehavior?: CostBehavior }) => {
    const trimmed = payload.name.trim();
    if (!trimmed) {
      return;
    }

    const category = payload.category === AccountCategory.EXPENSE ? AccountCategory.EXPENSE : AccountCategory.REVENUE;
    const normalizedCostBehavior = category === AccountCategory.EXPENSE ? (payload.costBehavior === 'fixed' ? 'fixed' : 'variable') : undefined;
    const entryType: Account['entryType'] = category === AccountCategory.EXPENSE
      ? (normalizedCostBehavior === 'fixed' ? 'manual' : 'transaction')
      : 'transaction';

    const newAccount: Account = {
      id: createId(category === AccountCategory.EXPENSE ? 'exp' : 'rev'),
      name: trimmed,
      category,
      costBehavior: normalizedCostBehavior,
      group: payload.group,
      isDeletable: true,
      entryType,
    };

    setFinancials(prev => prev ? {
      ...prev,
      accounts: {
        revenue: category === AccountCategory.REVENUE ? [...prev.accounts.revenue, newAccount] : prev.accounts.revenue,
        expense: category === AccountCategory.EXPENSE ? [...prev.accounts.expense, newAccount] : prev.accounts.expense,
      },
    } : prev);
  }, []);

  const removeAccount = useCallback((accountId: string) => {
    setFinancials(prev => {
      if (!prev) return null;

      const target = [...prev.accounts.revenue, ...prev.accounts.expense].find(acc => acc.id === accountId);
      if (!target) {
        return prev;
      }

      const cleanupData = <T extends Record<string, Record<string, any>>>(data: T): T => {
        const nextData: Record<string, Record<string, any>> = {};
        Object.entries(data).forEach(([month, monthData]) => {
          const { [accountId]: _removed, ...rest } = monthData || {};
          nextData[month] = rest;
        });
        return nextData as T;
      };

      const nextTemplates = target.costBehavior === 'fixed'
        ? (prev.fixedCostTemplates ?? []).filter(template => template.accountId !== accountId)
        : (prev.fixedCostTemplates ?? []);

      const removedTemplateIds = (prev.fixedCostTemplates ?? [])
        .filter(template => template.accountId === accountId)
        .map(template => template.id);

      const nextActuals = target.costBehavior === 'fixed'
        ? (prev.fixedCostActuals ?? []).filter(actual => !removedTemplateIds.includes(actual.templateId))
        : (prev.fixedCostActuals ?? []);

      return {
        ...prev,
        accounts: {
          revenue: prev.accounts.revenue.filter(acc => acc.id !== accountId),
          expense: prev.accounts.expense.filter(acc => acc.id !== accountId),
        },
        manualData: cleanupData(prev.manualData),
        transactionData: cleanupData(prev.transactionData),
        fixedCostTemplates: nextTemplates,
        fixedCostActuals: nextActuals,
      };
    });
  }, []);

  const updateAccount = useCallback((accountId: string, updates: Partial<Pick<Account, 'name' | 'group'>>) => {
    setFinancials(prev => {
      if (!prev) return null;

      const rename = (accs: Account[]) => accs.map(acc => (
        acc.id === accountId ? { ...acc, ...updates } : acc
      ));

      const nextRevenue = rename(prev.accounts.revenue);
      const nextExpense = rename(prev.accounts.expense);

      const isFixedExpense = nextExpense.some(acc => acc.id === accountId && acc.costBehavior === 'fixed');
      const nextTemplates = isFixedExpense && updates.name
        ? (prev.fixedCostTemplates ?? []).map(template => (
            template.accountId === accountId ? { ...template, serviceName: updates.name as string } : template
          ))
        : (prev.fixedCostTemplates ?? []);

      return {
        ...prev,
        accounts: {
          revenue: nextRevenue,
          expense: nextExpense,
        },
        fixedCostTemplates: nextTemplates,
      };
    });
  }, []);

  const updateManualAccountValue = useCallback((month: string, accountId: string, value: number) => {
    setFinancials(prev => prev ? {
      ...prev,
      manualData: {
        ...prev.manualData,
        [month]: {
          ...(prev.manualData[month] || {}),
          [accountId]: value,
        },
      },
    } : prev);
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
            ...(prev.transactionData[month] || {}),
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

  const addAccountGroup = useCallback((groupName: string, type: 'revenue' | 'expense') => {
    setFinancials(prev => {
      if (!prev) return prev;
      const trimmed = groupName.trim();
      if (!trimmed || prev.accountGroups[type].includes(trimmed)) {
        return prev;
      }

      return {
        ...prev,
        accountGroups: {
          ...prev.accountGroups,
          [type]: [...prev.accountGroups[type], trimmed],
        },
      };
    });
  }, []);

  const removeAccountGroup = useCallback((groupName: string, type: 'revenue' | 'expense') => {
    setFinancials(prev => {
      if (!prev) return null;
      const hasMembers = [...prev.accounts.revenue, ...prev.accounts.expense].some(acc => acc.group === groupName);

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

  const updateGroupName = useCallback((oldName: string, newName: string, type: 'revenue' | 'expense') => {
    const trimmed = newName.trim();
    if (!trimmed || oldName === trimmed) return;

    setFinancials(prev => {
      if (!prev) return null;

      const renameGroup = (groups: string[]) => groups.map(group => (group === oldName ? trimmed : group));
      const renameAccounts = (accs: Account[]) => accs.map(acc => (
        acc.group === oldName ? { ...acc, group: trimmed } : acc
      ));

      return {
        ...prev,
        accountGroups: {
          ...prev.accountGroups,
          [type]: renameGroup(prev.accountGroups[type]),
        },
        accounts: {
          revenue: type === 'revenue' ? renameAccounts(prev.accounts.revenue) : prev.accounts.revenue,
          expense: type === 'expense' ? renameAccounts(prev.accounts.expense) : prev.accounts.expense,
        },
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

      const templates = prev.fixedCostTemplates ?? [];
      const templateToRemove = templates.find(template => template.id === itemId);
      const nextTemplates = templates.filter(template => template.id !== itemId);
      const nextActuals = (prev.fixedCostActuals ?? []).filter(actual => actual.templateId !== itemId);

      if (!templateToRemove) {
        return {
          ...prev,
          fixedCostTemplates: nextTemplates,
          fixedCostActuals: nextActuals,
        };
      }

      const { accountId } = templateToRemove;
      const hasSiblingTemplate = nextTemplates.some(template => template.accountId === accountId);

      const cleanData = <T extends Record<string, Record<string, any>>>(data: T): T => {
        const result: Record<string, Record<string, any>> = {};
        Object.entries(data).forEach(([month, monthData]) => {
          const { [accountId]: _removed, ...rest } = monthData || {};
          result[month] = rest;
        });
        return result as T;
      };

      return {
        ...prev,
        accounts: {
          ...prev.accounts,
          expense: hasSiblingTemplate
            ? prev.accounts.expense
            : prev.accounts.expense.filter(acc => acc.id !== accountId),
          revenue: prev.accounts.revenue,
        },
        manualData: hasSiblingTemplate ? prev.manualData : cleanData(prev.manualData),
        transactionData: hasSiblingTemplate ? prev.transactionData : cleanData(prev.transactionData),
        fixedCostTemplates: nextTemplates,
        fixedCostActuals: nextActuals,
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
    const trimmed = name.trim();
    if (!trimmed) {
      return '';
    }

    const account: Account = {
      id: createId('exp-fix'),
      name: trimmed,
      category: AccountCategory.EXPENSE,
      costBehavior: 'fixed',
      group: COST_TYPE_GROUP[costType],
      isDeletable: true,
      entryType: 'manual',
    };

    setFinancials(prev => {
      if (!prev) return null;

      const ensureGroupExists = (groups: string[]) => (
        account.group && !groups.includes(account.group)
          ? [...groups, account.group]
          : groups
      );

      return {
        ...prev,
        accounts: {
          ...prev.accounts,
          expense: [...prev.accounts.expense, account],
        },
        accountGroups: {
          ...prev.accountGroups,
          expense: ensureGroupExists(prev.accountGroups.expense),
        },
      };
    });

    return account.id;
  }, []);

  const addMonthlyAccount = useCallback((month: string, payload: { name: string; category: AccountCategory; group: string; costBehavior?: CostBehavior }) => {
    const trimmed = payload.name.trim();
    if (!month || !trimmed) {
      return '';
    }

    const category = payload.category === AccountCategory.EXPENSE ? AccountCategory.EXPENSE : AccountCategory.REVENUE;
    const costBehavior = category === AccountCategory.EXPENSE ? (payload.costBehavior === 'fixed' ? 'fixed' : 'variable') : undefined;
    const entryType: Account['entryType'] = category === AccountCategory.EXPENSE
      ? (costBehavior === 'fixed' ? 'manual' : 'transaction')
      : 'transaction';

    const newAccount: Account = {
      id: createId(`temp-${category === AccountCategory.EXPENSE ? 'exp' : 'rev'}`),
      name: trimmed,
      category,
      costBehavior,
      group: payload.group,
      isDeletable: true,
      entryType,
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

      const cleanData = <T extends Record<string, Record<string, any>>>(data: T): T => {
        const nextData: Record<string, Record<string, any>> = {};
        Object.entries(data).forEach(([m, monthData]) => {
          if (m !== month) {
            nextData[m] = monthData;
            return;
          }
          const { [accountId]: _removed, ...rest } = monthData || {};
          nextData[m] = rest;
        });
        return nextData as T;
      };

      return {
        ...prev,
        manualData: cleanData(prev.manualData),
        transactionData: cleanData(prev.transactionData),
        monthlyOverrides: nextOverrides,
      };
    });
  }, []);

  const variableState: VariableAccountsState = useMemo(() => ({
    accounts: {
      revenue: accounts.revenue.filter(acc => !acc.isArchived),
      expense: accounts.expense.filter(acc => !acc.isArchived),
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
    accounts.expense,
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

  const fixedExpenseAccounts = useMemo(
    () => accounts.expense.filter(acc => acc.costBehavior === 'fixed' && !acc.isArchived),
    [accounts.expense],
  );

  const fixedState: FixedCostsState = useMemo(() => ({
    accounts: fixedExpenseAccounts,
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
    fixedExpenseAccounts,
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

  return {
    variable: variableState,
    fixed: fixedState,
    statement: statementState,
  };
};

export default useFinancialData;
