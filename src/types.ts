export enum AccountCategory {
  REVENUE = 'REVENUE',
  EXPENSE = 'EXPENSE',
}

export type CostBehavior = 'variable' | 'fixed';

export interface Account {
  id: string;
  name: string;
  category: AccountCategory;
  costBehavior?: CostBehavior;
  group?: string;
  isDeletable: boolean;
  entryType: 'manual' | 'transaction';
  isTemporary?: boolean;
  isArchived?: boolean;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
}

export type FixedCostType = 'ASSET_FINANCE' | 'OPERATING_SERVICE';

export interface FixedCostTemplate {
  id: string;
  accountId: string;
  costType: FixedCostType;
  serviceName: string;
  vendor: string;
  monthlyCost: number;
  paymentDate?: string;
  leaseTermMonths?: number;
  contractStartDate?: string;
  contractEndDate?: string;
  contractDetails?: string;
  renewalDate?: string;
}

export interface FixedCostActual {
  id: string;
  templateId: string;
  month: string;
  amount: number;
  isActive: boolean;
}

export interface FixedCostActualSnapshot {
  id: string;
  templateId: string;
  accountId: string;
  amount: number;
  isActive: boolean;
}

export type FixedCostActualMap = {
  [month: string]: {
    [templateId: string]: FixedCostActualSnapshot;
  };
};

export interface TransactionData {
  [month: string]: {
    [accountId: string]: Transaction[];
  };
}

export interface ManualData {
  [month: string]: {
    [accountId: string]: number;
  };
}

export interface CalculatedMonthData {
  totalRevenue: number;
  variableExpense: number;
  fixedExpense: number;
  totalExpense: number;
  operatingIncome: number;
  groupSubtotals: {
    [groupName: string]: number;
  };
}

export interface MonthlyAccountOverride {
  addedAccounts: Account[];
}

export type MonthlyAccountOverrides = {
  [month: string]: MonthlyAccountOverride;
};

export interface AccountGroups {
  revenue: string[];
  expense: string[];
}

export interface User {
  id: string;
  password?: string;
  name: string;
  email: string;
  role: 'superAdmin' | 'generalAdmin';
  tenantIds?: string[];
}

export interface Tenant {
  id: string;
  name: string;
}

export interface VariableAccountsState {
  accounts: {
    revenue: Account[];
    expense: Account[];
  };
  accountGroups: AccountGroups;
  transactionData: TransactionData;
  manualData: ManualData;
  saveStructure: (payload: {
    accounts: {
      revenue: Account[];
      expense: Account[];
    };
    accountGroups: AccountGroups;
  }) => Financials | null;
  addAccount: (payload: { name: string; category: AccountCategory; group: string; costBehavior?: CostBehavior }) => void;
  removeAccount: (id: string) => void;
  updateAccount: (accountId: string, updates: Partial<Pick<Account, 'name' | 'group'>>) => void;
  updateManualAccountValue: (month: string, accountId: string, value: number) => void;
  setTransactionAccountTotal: (month: string, accountId: string, totalAmount: number, accountName: string) => void;
  addTransaction: (month: string, accountId: string, transaction: Omit<Transaction, 'id'>) => void;
  removeTransaction: (month: string, accountId: string, transactionId: string) => void;
  updateTransaction: (month: string, accountId: string, transactionId: string, updates: Partial<Omit<Transaction, 'id'>>) => void;
  updateGroupName: (oldName: string, newName: string, type: 'revenue' | 'expense') => void;
  addAccountGroup: (groupName: string, type: 'revenue' | 'expense') => void;
  removeAccountGroup: (groupName: string, type: 'revenue' | 'expense') => void;
}

export interface FixedCostsState {
  accounts: Account[];
  templates: FixedCostTemplate[];
  actuals: FixedCostActual[];
  actualMap: FixedCostActualMap;
  activeAccountIdsByMonth: { [month: string]: string[] };
  addTemplate: (item: Omit<FixedCostTemplate, 'id'>) => string;
  updateTemplate: (itemId: string, updates: Partial<FixedCostTemplate>) => void;
  removeTemplate: (itemId: string) => void;
  upsertActual: (month: string, templateId: string, payload: { amount?: number; isActive?: boolean }) => void;
  removeActual: (month: string, templateId: string) => void;
  updateAccount: (accountId: string, updates: Partial<Pick<Account, 'name' | 'group'>>) => void;
  createAccount: (name: string, costType: FixedCostType) => string;
}

export interface IncomeStatementState {
  accounts: {
    revenue: Account[];
    expense: Account[];
  };
  accountValues: { [month: string]: { [accountId: string]: number } };
  calculatedData: { [month: string]: CalculatedMonthData };
  availableMonths: string[];
  fixedCostActuals: FixedCostActual[];
  monthlyOverrides: MonthlyAccountOverrides;
  addMonthlyAccount: (month: string, payload: { name: string; category: AccountCategory; group: string; costBehavior?: CostBehavior }) => string;
  updateMonthlyAccount: (month: string, accountId: string, updates: Partial<Pick<Account, 'name'>>) => void;
  removeMonthlyAccount: (month: string, accountId: string) => void;
}

export type MonthSourceType = 'template' | 'copy';

export interface MonthMetadataEntry {
  createdAt: string;
  sourceType: MonthSourceType;
  sourceMonth?: string;
  savedAt?: string;
}

export type MonthMetadataMap = Record<string, MonthMetadataEntry>;

export interface YearConfiguration {
  currentYear: number;
  minYear: number;
  maxYear: number;
  allowedYears: number[];
}

export interface MonthOverview {
  month: string;
  hasCommittedData: boolean;
  hasDraftData: boolean;
  committedMeta?: MonthMetadataEntry;
  draftMeta?: MonthMetadataEntry;
}

export interface UnsavedChangesState {
  structure: boolean;
  fixed: boolean;
  statement: boolean;
  any: boolean;
}

export interface DataVersions {
  draft: number;
  committed: number;
}

export interface UseFinancialDataReturn {
  variable: VariableAccountsState;
  fixed: FixedCostsState;
  statement: IncomeStatementState;
  unsaved: UnsavedChangesState;
  commitDraft: (override?: Financials) => void;
  resetDraft: () => void;
  monthMetadata: MonthOverview[];
  yearConfig: YearConfiguration;
  prepareMonth: (month: string, options: { mode: 'copyPrevious' | 'blank'; sourceMonth?: string; force?: boolean }) => boolean;
  getDefaultSourceMonth: (targetMonth?: string) => string | null;
  lastCommittedAt: string | null;
  versions: DataVersions;
  hasUnsavedChanges: boolean;
}

export interface AuthContextType {
  currentUser: User | null;
  activeTenantId: string | null;
  loading: boolean;
  login: (id: string, password?: string) => Promise<User | null>;
  logout: () => void;
  setActiveTenantId: (tenantId: string) => void;
  availableTenants: Tenant[];
  exitHospitalManagement: () => void;
  isInHospitalManagementMode: boolean;
}

export interface Financials {
  templateVersion?: string;
  accounts: {
    revenue: Account[];
    expense: Account[];
  };
  accountGroups: AccountGroups;
  transactionData: TransactionData;
  manualData: ManualData;
  fixedCostTemplates: FixedCostTemplate[];
  fixedCostActuals: FixedCostActual[];
  monthlyOverrides?: MonthlyAccountOverrides;
  monthMeta?: MonthMetadataMap;
}

export interface SystemSettings {
  tenantTemplate: {
    version: string;
    accountGroups: {
      revenue: string[];
      expense: string[];
    };
    accounts: {
      revenue: Account[];
      expense: Account[];
    };
    fixedCostTemplates: FixedCostTemplate[];
    fixedCostActualDefaults?: FixedCostActual[];
    initialMonths: string[];
    manualDataDefaults?: ManualData;
    transactionDataDefaults?: TransactionData;
    monthMetaDefaults?: MonthMetadataMap;
  };
  branding?: {
    systemName?: string;
    logoUrl?: string;
  };
  security?: {
    passwordPolicy?: object;
    sessionTimeout?: number;
  };
  notifications?: {
    emailSettings?: object;
  };
}

export interface DB {
  users: User[];
  tenants: Tenant[];
  financialData: {
    [tenantId: string]: Financials;
  };
  settings?: SystemSettings;
}
