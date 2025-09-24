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
  MonthMetadataMap,
  MonthOverview,
  MonthSourceType,
  Transaction,
  UseFinancialDataReturn,
  VariableAccountsState,
  FixedCostsState,
  YearConfiguration,
} from '../types';
import DatabaseService from '../services/DatabaseService';
import { buildAllowedYearSequence, getClientCurrentYear, isMonthWithinYearRange } from '../utils/dateHelpers';

const LEGACY_COST_BEHAVIOR_MAP: Record<string, CostBehavior> = {
  COGS: 'variable',
  SGA_VARIABLE: 'variable',
  SGA_FIXED: 'fixed',
};

const LEGACY_EXPENSE_CATEGORIES = new Set(Object.keys(LEGACY_COST_BEHAVIOR_MAP));

const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const COST_TYPE_GROUP: Record<FixedCostType, string> = {
  ASSET_FINANCE: '由ъ뒪/湲덉쑖 ?먯궛',
  OPERATING_SERVICE: '?댁쁺 ?쒕퉬??怨꾩빟',
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
    name: String(raw.name ?? '誘몄젙'),
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

const isObject = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const deepEqual = (left: unknown, right: unknown): boolean => {
  if (left === right) {
    return true;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }
    for (let index = 0; index < left.length; index += 1) {
      if (!deepEqual(left[index], right[index])) {
        return false;
      }
    }
    return true;
  }

  if (isObject(left) || isObject(right)) {
    if (!isObject(left) || !isObject(right)) {
      return false;
    }
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) {
      return false;
    }
    for (const key of leftKeys) {
      if (!rightKeys.includes(key)) {
        return false;
      }
      if (!deepEqual(left[key], right[key])) {
        return false;
      }
    }
    return true;
  }

  return left === right;
};

const extractStructureSlice = (financials: Financials | null) => {
  if (!financials) return null;
  return {
    accounts: financials.accounts,
    accountGroups: financials.accountGroups,
  };
};

const extractFixedSlice = (financials: Financials | null) => {
  if (!financials) return null;
  return {
    templates: financials.fixedCostTemplates,
    actuals: financials.fixedCostActuals,
  };
};

const extractStatementSlice = (financials: Financials | null) => {
  if (!financials) return null;
  return {
    transactionData: financials.transactionData,
    manualData: financials.manualData,
    monthlyOverrides: financials.monthlyOverrides ?? {},
  };
};

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

const normalizeMonthMeta = (input: any): MonthMetadataMap => {
  if (!input || typeof input !== 'object') {
    return {};
  }

  const normalized: MonthMetadataMap = {};
  Object.entries(input as Record<string, any>).forEach(([month, value]) => {
    if (!value || typeof value !== 'object') {
      return;
    }
    const sourceType = value.sourceType === 'copy' ? 'copy' : 'template';
    normalized[month] = {
      createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
      sourceType,
      sourceMonth: typeof value.sourceMonth === 'string' ? value.sourceMonth : undefined,
      savedAt: typeof value.savedAt === 'string' ? value.savedAt : undefined,
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
      monthMeta: {},
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
    monthMeta: normalizeMonthMeta(raw.monthMeta),
  };
};

const EMPTY_FINANCIALS: Financials = {
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
  monthMeta: {},
};

const cloneFinancials = (data: Financials): Financials => JSON.parse(JSON.stringify(data));

const monthHasData = (financials: Financials | null, month: string): boolean => {
  if (!financials) return false;
  const transactions = financials.transactionData?.[month];
  if (transactions && Object.values(transactions).some(list => (list?.length ?? 0) > 0)) {
    return true;
  }
  const manual = financials.manualData?.[month];
  if (manual && Object.keys(manual).length > 0) {
    return true;
  }
  const overrides = financials.monthlyOverrides?.[month];
  if (overrides && overrides.addedAccounts && overrides.addedAccounts.length > 0) {
    return true;
  }
  if (financials.fixedCostActuals?.some(actual => actual.month === month && actual.isActive)) {
    return true;
  }
  return false;
};

const collectMonths = (financials: Financials | null): string[] => {
  if (!financials) return [];
  const set = new Set<string>();
  Object.keys(financials.transactionData || {}).forEach(month => set.add(month));
  Object.keys(financials.manualData || {}).forEach(month => set.add(month));
  Object.keys(financials.monthlyOverrides || {}).forEach(month => set.add(month));
  financials.fixedCostActuals?.forEach(actual => set.add(actual.month));
  Object.keys(financials.monthMeta || {}).forEach(month => set.add(month));
  return Array.from(set);
};

const sortMonths = (months: string[]): string[] => [...months].sort();

const findLatestSavedAt = (financials: Financials | null): string | null => {
  if (!financials?.monthMeta) {
    return null;
  }
  let latest: string | null = null;
  Object.values(financials.monthMeta).forEach(meta => {
    if (!meta?.savedAt) {
      return;
    }
    if (!latest || meta.savedAt > latest) {
      latest = meta.savedAt;
    }
  });
  return latest;
};

const useFinancialData = (tenantId: string | undefined): UseFinancialDataReturn | null => {
  const currentYear = useMemo(() => getClientCurrentYear(), []);
  const allowedYears = useMemo(() => buildAllowedYearSequence(currentYear, 1, 1), [currentYear]);
  const minAllowedYear = allowedYears[0];
  const maxAllowedYear = allowedYears[allowedYears.length - 1];

  const [committedFinancials, setCommittedFinancials] = useState<Financials | null>(null);
  const [draftFinancials, setDraftFinancials] = useState<Financials | null>(null);
  const [committedVersion, setCommittedVersion] = useState(0);
  const [draftVersion, setDraftVersion] = useState(0);
  const [lastCommittedAt, setLastCommittedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) {
      setCommittedFinancials(null);
      setDraftFinancials(null);
      setCommittedVersion(0);
      setDraftVersion(0);
      setLastCommittedAt(null);
      return;
    }
    const raw = DatabaseService.getFinancials(tenantId);
    const normalized = normalizeFinancials(raw);
    setCommittedFinancials(cloneFinancials(normalized));
    setDraftFinancials(cloneFinancials(normalized));
    const initialVersion = Date.now();
    setCommittedVersion(initialVersion);
    setDraftVersion(initialVersion);
    setLastCommittedAt(findLatestSavedAt(normalized));
  }, [tenantId]);

  useEffect(() => {
    if (tenantId && committedFinancials) {
      DatabaseService.saveFinancials(tenantId, committedFinancials);
    }
  }, [tenantId, committedFinancials]);

  const unsavedStructure = useMemo(() => (
    !deepEqual(
      extractStructureSlice(draftFinancials),
      extractStructureSlice(committedFinancials),
    )
  ), [draftFinancials, committedFinancials]);

  const unsavedFixed = useMemo(() => (
    !deepEqual(
      extractFixedSlice(draftFinancials),
      extractFixedSlice(committedFinancials),
    )
  ), [draftFinancials, committedFinancials]);

  const unsavedStatement = useMemo(() => (
    !deepEqual(
      extractStatementSlice(draftFinancials),
      extractStatementSlice(committedFinancials),
    )
  ), [draftFinancials, committedFinancials]);

  const hasUnsavedChanges = unsavedStructure || unsavedFixed || unsavedStatement;

  const commitDraft = useCallback((override?: Financials) => {
    const base = override ? cloneFinancials(override) : (draftFinancials ? cloneFinancials(draftFinancials) : null);
    if (!base) {
      return;
    }

    const timestamp = new Date().toISOString();
    base.monthMeta = base.monthMeta ? { ...base.monthMeta } : {};

    collectMonths(base).forEach(month => {
      if (monthHasData(base, month)) {
        const existing = base.monthMeta?.[month];
        base.monthMeta[month] = {
          createdAt: existing?.createdAt ?? timestamp,
          sourceType: existing?.sourceType ?? 'template',
          sourceMonth: existing?.sourceMonth,
          savedAt: timestamp,
        };
      }
    });

    setCommittedFinancials(base);
    setDraftFinancials(cloneFinancials(base));
    setLastCommittedAt(timestamp);
    setCommittedVersion(prev => prev + 1);
    setDraftVersion(prev => prev + 1);
  }, [draftFinancials]);

  const resetDraft = useCallback(() => {
    if (!committedFinancials) {
      return;
    }
    setDraftFinancials(cloneFinancials(committedFinancials));
    setDraftVersion(prev => prev + 1);
  }, [committedFinancials]);

  const workingFinancials = draftFinancials ?? EMPTY_FINANCIALS;

  const {
    accounts,
    accountGroups,
    transactionData,
    manualData,
    monthlyOverrides = {},
    fixedCostTemplates = [],
    fixedCostActuals = [],
  } = workingFinancials;

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
  }): Financials | null => {
    let applied: Financials | null = null;
    setDraftFinancials(prev => {
      if (!prev) return prev;

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

      const next: Financials = {
        ...prev,
        accounts: {
          revenue: mergeAccounts(prev.accounts.revenue, payload.accounts.revenue),
          expense: mergeAccounts(prev.accounts.expense, payload.accounts.expense),
        },
        accountGroups: payload.accountGroups,
      };
      applied = next;
      return next;
    });
    return applied ? cloneFinancials(applied) : null;
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

    setDraftFinancials(prev => prev ? {
      ...prev,
      accounts: {
        revenue: category === AccountCategory.REVENUE ? [...prev.accounts.revenue, newAccount] : prev.accounts.revenue,
        expense: category === AccountCategory.EXPENSE ? [...prev.accounts.expense, newAccount] : prev.accounts.expense,
      },
    } : prev);
  }, []);

  const removeAccount = useCallback((accountId: string) => {
    setDraftFinancials(prev => {
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
    setDraftFinancials(prev => {
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
    setDraftFinancials(prev => prev ? {
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

    setDraftFinancials(prev => {
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

    setDraftFinancials(prev => {
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
    setDraftFinancials(prev => {
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
    setDraftFinancials(prev => {
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
    setDraftFinancials(prev => {
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
    setDraftFinancials(prev => {
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

    setDraftFinancials(prev => {
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

    setDraftFinancials(prev => prev ? {
      ...prev,
      fixedCostTemplates: [...(prev.fixedCostTemplates ?? []), newTemplate],
    } : prev);

    return newTemplate.id;
  }, []);

  const updateFixedCostTemplate = useCallback((itemId: string, updates: Partial<FixedCostTemplate>) => {
    setDraftFinancials(prev => prev ? {
      ...prev,
      fixedCostTemplates: (prev.fixedCostTemplates ?? []).map(template => (
        template.id === itemId ? { ...template, ...updates } : template
      )),
    } : null);
  }, []);

  const removeFixedCostTemplate = useCallback((itemId: string) => {
    setDraftFinancials(prev => {
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
    setDraftFinancials(prev => {
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
    setDraftFinancials(prev => prev ? {
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

    setDraftFinancials(prev => {
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

    setDraftFinancials(prev => {
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
    setDraftFinancials(prev => {
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
    setDraftFinancials(prev => {
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

  const getDefaultSourceMonth = useCallback((targetMonth?: string) => {
    if (!committedFinancials) {
      return null;
    }
    const committedMonthsWithData = sortMonths(
      collectMonths(committedFinancials)
        .filter(month => monthHasData(committedFinancials, month))
        .filter(month => isMonthWithinYearRange(month, minAllowedYear, maxAllowedYear)),
    );
    if (committedMonthsWithData.length === 0) {
      return null;
    }
    if (!targetMonth) {
      return committedMonthsWithData[committedMonthsWithData.length - 1];
    }
    const before = committedMonthsWithData.filter(month => month < targetMonth);
    if (before.length > 0) {
      return before[before.length - 1];
    }
    return committedMonthsWithData[committedMonthsWithData.length - 1];
  }, [committedFinancials, maxAllowedYear, minAllowedYear]);

    const prepareMonth = useCallback((month: string, options: { mode: 'copyPrevious' | 'blank'; sourceMonth?: string; force?: boolean }) => {
    if (!month) {
      return false;
    }

    if (!isMonthWithinYearRange(month, minAllowedYear, maxAllowedYear)) {
      console.warn(`Attempted to prepare month ${month} outside the allowed range (${minAllowedYear}-${maxAllowedYear}).`);
      return false;
    }

    let prepared = false;

    setDraftFinancials(prev => {
      if (!prev) return prev;

      const normalizedMonth = month;
      const next = cloneFinancials(prev);
      next.monthMeta = next.monthMeta ? { ...next.monthMeta } : {};

      const existingData = monthHasData(next, normalizedMonth);
      if (existingData && !options.force) {
        return prev;
      }

      delete next.transactionData[normalizedMonth];
      delete next.manualData[normalizedMonth];
      if (next.monthlyOverrides) {
        delete next.monthlyOverrides[normalizedMonth];
      }
      next.fixedCostActuals = next.fixedCostActuals.filter(actual => actual.month !== normalizedMonth);

      const cloneDeep = <T>(value: T): T => JSON.parse(JSON.stringify(value));

      let resolvedSource = options.sourceMonth;
      let sourceType: MonthSourceType = 'template';
      let sourceMonth: string | undefined;

      if (options.mode === 'copyPrevious') {
        const fallbackSource = getDefaultSourceMonth(normalizedMonth);
        if (!resolvedSource || !monthHasData(prev, resolvedSource)) {
          resolvedSource = fallbackSource ?? undefined;
        }
        if (resolvedSource && monthHasData(prev, resolvedSource) && isMonthWithinYearRange(resolvedSource, minAllowedYear, maxAllowedYear)) {
          sourceType = 'copy';
          sourceMonth = resolvedSource;
        } else {
          resolvedSource = undefined;
        }
      }

      if (sourceType === 'copy' && resolvedSource) {
        next.transactionData[normalizedMonth] = cloneDeep(prev.transactionData[resolvedSource] || {});
        next.manualData[normalizedMonth] = cloneDeep(prev.manualData[resolvedSource] || {});
        next.monthlyOverrides = next.monthlyOverrides || {};
        next.monthlyOverrides[normalizedMonth] = cloneDeep(prev.monthlyOverrides?.[resolvedSource] || { addedAccounts: [] });

        prev.fixedCostActuals
          .filter(actual => actual.month === resolvedSource)
          .forEach(actual => {
            const cloned = cloneDeep(actual);
            cloned.id = createId('fca');
            cloned.month = normalizedMonth;
            next.fixedCostActuals.push(cloned);
          });
      } else {
        next.transactionData[normalizedMonth] = {};
        next.manualData[normalizedMonth] = {};
        next.monthlyOverrides = next.monthlyOverrides || {};
        next.monthlyOverrides[normalizedMonth] = { addedAccounts: [] };
        next.fixedCostTemplates.forEach(templateItem => {
          next.fixedCostActuals.push({
            id: createId('fca'),
            templateId: templateItem.id,
            month: normalizedMonth,
            amount: 0,
            isActive: false,
          });
        });
        sourceType = 'template';
        sourceMonth = undefined;
      }

      const createdAt = new Date().toISOString();
      next.monthMeta[normalizedMonth] = {
        createdAt,
        sourceType,
        ...(sourceMonth ? { sourceMonth } : {}),
      };

      prepared = true;
      return next;
    });

    return prepared;
  }, [getDefaultSourceMonth]);

  const monthMetadata = useMemo(() => {
    const committedMonths = collectMonths(committedFinancials);
    const draftMonths = collectMonths(draftFinancials);
    const combined = sortMonths(Array.from(new Set<string>([
      ...committedMonths,
      ...draftMonths,
    ]))).filter(monthValue => isMonthWithinYearRange(monthValue, minAllowedYear, maxAllowedYear));

    return combined.map(monthValue => ({
      month: monthValue,
      hasCommittedData: monthHasData(committedFinancials, monthValue),
      hasDraftData: monthHasData(draftFinancials, monthValue),
      committedMeta: committedFinancials?.monthMeta?.[monthValue],
      draftMeta: draftFinancials?.monthMeta?.[monthValue] ?? committedFinancials?.monthMeta?.[monthValue],
    }));
  }, [committedFinancials, draftFinancials, maxAllowedYear, minAllowedYear]);

  const yearConfig: YearConfiguration = useMemo(() => ({
    currentYear,
    minYear: minAllowedYear,
    maxYear: maxAllowedYear,
    allowedYears,
  }), [allowedYears, currentYear, maxAllowedYear, minAllowedYear]);

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

  const result: UseFinancialDataReturn = {
    variable: variableState,
    fixed: fixedState,
    statement: statementState,
    unsaved: {
      structure: unsavedStructure,
      fixed: unsavedFixed,
      statement: unsavedStatement,
      any: hasUnsavedChanges,
    },
    hasUnsavedChanges,
    commitDraft,
    resetDraft,
    monthMetadata,
    yearConfig,
    prepareMonth,
    getDefaultSourceMonth,
    lastCommittedAt,
    versions: {
      draft: draftVersion,
      committed: committedVersion,
    },
  };

  if (!draftFinancials || !committedFinancials) {
    return null;
  }

  return result;
};

export default useFinancialData;
