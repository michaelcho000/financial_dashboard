export enum AccountCategory {
  REVENUE = 'REVENUE',
  COGS = 'COGS',
  SGA_FIXED = 'SGA_FIXED',
  SGA_VARIABLE = 'SGA_VARIABLE',
}

export interface Account {
  id: string;
  name: string;
  category: AccountCategory;
  group?: string; // Grouping for display (e.g., '인건비')
  isDeletable: boolean;
  entryType: 'manual' | 'transaction';
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
}

export type FixedCostType = 'ASSET_FINANCE' | 'OPERATING_SERVICE';

export interface FixedCostLedgerItem {
  id: string; // 고유 ID
  accountId: string; // '계정 관리'에 등록된 계정과목 ID
  costType: FixedCostType; // '자산형'과 '운영성'을 구분하는 핵심 필드

  // 공통 정보
  serviceName: string; // 서비스/자산명 ('계정 관리'의 계정명과 동기화)
  vendor: string; // 업체명 (예: '롯데카드', 'KT 통신')
  monthlyCost: number; // 월 납입액/사용료
  paymentDate?: string; // 출금일
  
  // 자산형(ASSET_FINANCE)에만 해당하는 상세 정보
  leaseTermMonths?: number; // 계약 기간 (개월)
  contractStartDate?: string; // 계약 시작일
  contractEndDate?: string; // 만기일자

  // 운영성(OPERATING_SERVICE)에만 해당하는 상세 정보
  contractDetails?: string; // 기타 계약 현황 (예: '1년 약정')
  renewalDate?: string; // 갱신 예정일
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
  revenue: number;
  cogs: number;
  grossProfit: number;
  cogsRatio: number;
  sgaFixed: number;
  sgaVariable: number;
  totalSga: number;
  operatingProfit: number;
  groupSubtotals: {
    [groupName: string]: number;
  };
}

export interface AccountGroups {
  revenue: string[];
  cogs: string[];
  sga: string[];
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

export interface UseFinancialDataReturn {
  accounts: {
    revenue: Account[];
    cogs: Account[];
    sgaFixed: Account[];
    sgaVariable: Account[];
  };
  allAccounts: Account[];
  accountGroups: AccountGroups;
  transactionData: TransactionData;
  manualData: ManualData;
  fixedCostLedger: FixedCostLedgerItem[];
  accountValues: { [month: string]: { [accountId: string]: number } };
  calculatedData: {
    [month: string]: CalculatedMonthData;
  };
  addAccount: (name: string, category: AccountCategory, group: string) => void;
  removeAccount: (id: string, category: AccountCategory) => void;
  updateAccount: (accountId: string, updates: Partial<Pick<Account, 'name' | 'group'>>) => void;
  updateManualAccountValue: (month: string, accountId: string, value: number) => void;
  setTransactionAccountTotal: (month: string, accountId: string, totalAmount: number, accountName: string) => void;
  addTransaction: (month: string, accountId: string, transaction: Omit<Transaction, 'id'>) => void;
  removeTransaction: (month: string, accountId: string, transactionId: string) => void;
  updateTransaction: (month: string, accountId: string, transactionId: string, updates: Partial<Omit<Transaction, 'id'>>) => void;
  addFixedCostLedgerItem: (item: Omit<FixedCostLedgerItem, 'id'>) => void;
  updateFixedCostLedgerItem: (itemId: string, updates: Partial<FixedCostLedgerItem>) => void;
  removeFixedCostLedgerItem: (itemId: string) => void;
  updateGroupName: (oldName: string, newName: string, type: 'revenue' | 'cogs' | 'sga') => void;
  addAccountGroup: (groupName: string, type: 'revenue' | 'cogs' | 'sga') => void;
  removeAccountGroup: (groupName: string, type: 'revenue' | 'cogs' | 'sga') => void;
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
        cogs: Account[];
        sgaFixed: Account[];
        sgaVariable: Account[];
    };
    accountGroups: AccountGroups;
    transactionData: TransactionData;
    manualData: ManualData;
    fixedCostLedger: FixedCostLedgerItem[];
}

// 시스템 설정을 위한 템플릿 구조
export interface SystemSettings {
  tenantTemplate: {
    version: string;  // 템플릿 전용 버전 관리
    accountGroups: {
      revenue: string[];
      cogs: string[];
      sga: string[];
    };
    accounts: {
      revenue: Account[];
      cogs: Account[];
      sgaFixed: Account[];
      sgaVariable: Account[];
    };
    fixedCostLedger: FixedCostLedgerItem[];
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
