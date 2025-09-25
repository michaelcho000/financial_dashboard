const STORAGE_KEY = 'financial_app_user_preferences';

type StatementPreferenceRecord = {
  primaryMonth?: string | null;
  comparisonMonth?: string | null;
  updatedAt?: string;
};

type TenantPreferenceRecord = {
  incomeStatement?: StatementPreferenceRecord;
};

type PreferenceStore = {
  [userId: string]: {
    [tenantId: string]: TenantPreferenceRecord;
  };
};

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const isBrowserStorageAvailable = (): boolean => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return false;
  }
  try {
    const key = '__preferences_test__';
    window.localStorage.setItem(key, '1');
    window.localStorage.removeItem(key);
    return true;
  } catch (_error) {
    return false;
  }
};

const isMonthValue = (value: string | null | undefined): value is string => (
  typeof value === 'string' && MONTH_PATTERN.test(value)
);

const clonePreferenceStore = (store: PreferenceStore): PreferenceStore => (
  JSON.parse(JSON.stringify(store))
);

const cleanupStore = (store: PreferenceStore): PreferenceStore => {
  const next: PreferenceStore = {};
  Object.entries(store).forEach(([userId, tenantMap]) => {
    const cleanedTenantMap: Record<string, TenantPreferenceRecord> = {};
    Object.entries(tenantMap ?? {}).forEach(([tenantId, preferences]) => {
      if (preferences && preferences.incomeStatement) {
        cleanedTenantMap[tenantId] = { ...preferences };
      }
    });
    if (Object.keys(cleanedTenantMap).length > 0) {
      next[userId] = cleanedTenantMap;
    }
  });
  return next;
};

const readStore = (): PreferenceStore => {
  if (!isBrowserStorageAvailable()) {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as PreferenceStore;
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    return cleanupStore(parsed);
  } catch (_error) {
    return {};
  }
};

const writeStore = (store: PreferenceStore): void => {
  if (!isBrowserStorageAvailable()) {
    return;
  }
  try {
    const cleaned = cleanupStore(store);
    if (Object.keys(cleaned).length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
  } catch (_error) {
    // Ignore persistence errors but avoid throwing to keep UX responsive.
  }
};

const getCurrentMonthIso = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export interface StatementMonthPreference {
  primary: string | null;
  comparison: string | null;
}

export interface ResolveStatementMonthsParams {
  storedPrimary: string | null;
  storedComparison: string | null;
  availableMonths: string[];
  defaultSourceMonth?: string | null;
  fallbackMonth?: string | null;
}

class UserPreferenceService {
  static getFallbackPrimaryMonth(): string {
    return getCurrentMonthIso();
  }

  static getStatementMonths(userId: string | null | undefined, tenantId: string | null | undefined): StatementMonthPreference {
    if (!userId || !tenantId) {
      return { primary: null, comparison: null };
    }
    const store = readStore();
    const preferences = store[userId]?.[tenantId]?.incomeStatement;
    const primary = isMonthValue(preferences?.primaryMonth) ? preferences?.primaryMonth ?? null : null;
    const comparison = isMonthValue(preferences?.comparisonMonth) ? preferences?.comparisonMonth ?? null : null;
    return { primary, comparison };
  }

  static setStatementMonths(
    userId: string | null | undefined,
    tenantId: string | null | undefined,
    months: [string, string | null],
  ): void {
    if (!userId || !tenantId) {
      return;
    }
    const [primary, comparison] = months;
    const normalizedPrimary = isMonthValue(primary) ? primary : null;
    const normalizedComparison = isMonthValue(comparison) && normalizedPrimary && comparison !== normalizedPrimary
      ? comparison
      : null;

    const store = clonePreferenceStore(readStore());

    if (!store[userId]) {
      store[userId] = {};
    }
    if (!store[userId][tenantId]) {
      store[userId][tenantId] = {};
    }

    if (!normalizedPrimary) {
      delete store[userId][tenantId].incomeStatement;
    } else {
      store[userId][tenantId].incomeStatement = {
        primaryMonth: normalizedPrimary,
        comparisonMonth: normalizedComparison,
        updatedAt: new Date().toISOString(),
      };
    }

    writeStore(store);
  }

  static resolveInitialStatementMonths({
    storedPrimary,
    storedComparison,
    availableMonths,
    defaultSourceMonth,
    fallbackMonth,
  }: ResolveStatementMonthsParams): StatementMonthPreference {
    const uniqueAvailable = Array.from(new Set((availableMonths ?? []).filter(isMonthValue))).sort();

    const normalizedStoredPrimary = isMonthValue(storedPrimary) && uniqueAvailable.includes(storedPrimary)
      ? storedPrimary
      : null;

    const normalizedDefaultSource = isMonthValue(defaultSourceMonth) && uniqueAvailable.includes(defaultSourceMonth)
      ? defaultSourceMonth
      : null;

    const latestAvailable = uniqueAvailable.length > 0
      ? uniqueAvailable[uniqueAvailable.length - 1]
      : null;

    const fallback = isMonthValue(fallbackMonth) ? fallbackMonth : (isMonthValue(normalizedDefaultSource) ? normalizedDefaultSource : null);
    const resolvedPrimary = normalizedStoredPrimary
      ?? normalizedDefaultSource
      ?? latestAvailable
      ?? fallback
      ?? this.getFallbackPrimaryMonth();

    const normalizedStoredComparison = isMonthValue(storedComparison) && uniqueAvailable.includes(storedComparison)
      ? storedComparison
      : null;

    const resolvedComparison = (normalizedStoredComparison && normalizedStoredComparison !== resolvedPrimary)
      ? normalizedStoredComparison
      : null;

    return { primary: resolvedPrimary, comparison: resolvedComparison };
  }
}

export default UserPreferenceService;
