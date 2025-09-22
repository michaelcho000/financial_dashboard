export enum AccountCategory {
  REVENUE = 'REVENUE',
  EXPENSE = 'EXPENSE',
}

export type CostBehavior = 'variable' | 'fixed';

export interface Account {
  id: string;
  name: string;
  category: AccountCategory;
  costBehavior?: CostBehavior; // 지출 계정 비용 성격 (없으면 변동비)
  group?: string; // Grouping for display (e.g., '인건비')
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
  id: string; // 템플릿 고유 ID
  accountId: string; // '계정 관리'에 등록된 고정비 계정 ID
  costType: FixedCostType;

  // 공통 정보
  serviceName: string; // 서비스/자산명 ('계정 관리'와 동기화)
  vendor: string; // 업체명 (예: '롯데카드', 'KT 통신')
  monthlyCost: number; // 기본 월 납입액/사용료
  paymentDate?: string; // 출금일

  // 자산형(ASSET_FINANCE)에만 해당
  leaseTermMonths?: number;
  contractStartDate?: string;
  contractEndDate?: string;

  // 운영 서비스(OPERATING_SERVICE)에만 해당
  contractDetails?: string;
  renewalDate?: string;
}

export interface FixedCostActual {
  id: string; // 고유 ID
  templateId: string; // FixedCostTemplate 참조
  month: string; // 적용 월 (YYYY-MM)
  amount: number; // 해당 월 납입액 (수정 가능)
  isActive: boolean; // 해당 월에 반영 여부
}


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
  }) => void;
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
  accounts: Account[]; // 고정비 계정 (expense 중 costBehavior === 'fixed')
  templates: FixedCostTemplate[];
  actuals: FixedCostActual[];
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

export interface UseFinancialDataReturn {
  variable: VariableAccountsState;
  fixed: FixedCostsState;
  statement: IncomeStatementState;
}


// New types for Auth and DB
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
    templateVersion?: string; // 이 병원 데이터가 기반한 템플릿 버전
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
}

// 시스템 설정을 위한 템플릿 구조
export interface SystemSettings {
  tenantTemplate: {
    version: string;  // 템플릿 전용 버전 관리
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
    initialMonths: string[];   // 기본 제공 월(예: ['2025-08'])
    manualDataDefaults?: ManualData;
    transactionDataDefaults?: TransactionData;
  };
  // 향후 확장을 위한 placeholder
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
