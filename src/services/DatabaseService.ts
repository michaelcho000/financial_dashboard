import { AccountCategory, DB, Financials, SystemSettings, Tenant, User } from '../types';

const DB_KEY = 'financial_app_db';
const DB_SCHEMA_VERSION = '1.0.0'; // DB 스키마 버전 (필드 구조 변경시에만 증가)
const TEMPLATE_VERSION = '2.0.0'; // 템플릿 버전 (대표 계정 변경시 증가)

const initialFinancials: Financials = {
    accounts: {
        revenue: [
            { id: 'rev-1', name: '비급여 일반수익', category: AccountCategory.REVENUE, group: '비급여 수익', isDeletable: true, entryType: 'transaction' },
            { id: 'rev-2', name: '멤버십/패키지', category: AccountCategory.REVENUE, group: '비급여 수익', isDeletable: true, entryType: 'transaction' },
            { id: 'rev-3', name: '보험 청구수익', category: AccountCategory.REVENUE, group: '보험 수익', isDeletable: true, entryType: 'transaction' },
            { id: 'rev-4', name: '보험 본인부담금', category: AccountCategory.REVENUE, group: '보험 수익', isDeletable: true, entryType: 'transaction' },
            { id: 'rev-5', name: '기타 수익', category: AccountCategory.REVENUE, group: '기타 수익', isDeletable: true, entryType: 'transaction' },
        ],
        cogs: [
            { id: 'cogs-1', name: '시술 재료비', category: AccountCategory.COGS, group: '시술 원가', isDeletable: true, entryType: 'transaction' },
            { id: 'cogs-2', name: '시술 직접 인건비', category: AccountCategory.COGS, group: '직접 인건비', isDeletable: true, entryType: 'manual' },
            { id: 'cogs-3', name: '외주/검사비', category: AccountCategory.COGS, group: '외주/검사비', isDeletable: true, entryType: 'transaction' },
            { id: 'cogs-4', name: '멤버십 원가', category: AccountCategory.COGS, group: '시술 원가', isDeletable: true, entryType: 'transaction' },
        ],
        sgaFixed: [
            { id: 'sga-fix-1', name: '관리직 인건비', category: AccountCategory.SGA_FIXED, group: '인건비', isDeletable: false, entryType: 'manual' },
            { id: 'sga-fix-2', name: '4대보험료', category: AccountCategory.SGA_FIXED, group: '인건비', isDeletable: false, entryType: 'manual' },
            { id: 'sga-fix-3', name: '임차료', category: AccountCategory.SGA_FIXED, group: '임차/관리', isDeletable: false, entryType: 'manual' },
            { id: 'sga-fix-4', name: '공과금/관리비', category: AccountCategory.SGA_FIXED, group: '임차/관리', isDeletable: true, entryType: 'manual' },
            { id: 'sga-fix-5', name: '감가상각/장비리스', category: AccountCategory.SGA_FIXED, group: '기타 비용', isDeletable: true, entryType: 'manual' },
        ],
        sgaVariable: [
            { id: 'sga-var-1', name: '마케팅/광고비', category: AccountCategory.SGA_VARIABLE, group: '마케팅/운영', isDeletable: true, entryType: 'transaction' },
            { id: 'sga-var-2', name: '소모품/소모재', category: AccountCategory.SGA_VARIABLE, group: '마케팅/운영', isDeletable: true, entryType: 'transaction' },
            { id: 'sga-var-3', name: '교육/복지비', category: AccountCategory.SGA_VARIABLE, group: '인건비', isDeletable: true, entryType: 'transaction' },
            { id: 'sga-var-4', name: '기타 운용비', category: AccountCategory.SGA_VARIABLE, group: '기타 비용', isDeletable: true, entryType: 'transaction' },
        ],
    },
    accountGroups: {
        revenue: ['비급여 수익', '보험 수익', '기타 수익'],
        cogs: ['시술 원가', '직접 인건비', '외주/검사비'],
        sga: ['인건비', '임차/관리', '마케팅/운영', '기타 비용']
    },
    transactionData: {
        '2025-08': {
            'rev-1': [{ id: 't-rev-1', description: '8월 비급여 매출', amount: 250000000 }],
            'cogs-1': [{ id: 't-cogs-1', description: '시술 재료비', amount: 13100000 }],
        },
        '2025-07': {
            'rev-1': [{ id: 't-rev-1-jul', description: '7월 비급여 매출', amount: 300000000 }],
        },
    },
    manualData: {},
    fixedCostLedger: [
        { id: 'fcl-1', accountId: 'sga-fix-1', costType: 'OPERATING_SERVICE', serviceName: '관리직 인건비', vendor: '내부', monthlyCost: 80000000, paymentDate: '매월 10일' },
        { id: 'fcl-2', accountId: 'sga-fix-2', costType: 'OPERATING_SERVICE', serviceName: '4대보험료', vendor: '정부', monthlyCost: 12000000, paymentDate: '매월 10일' },
        { id: 'fcl-3', accountId: 'sga-fix-3', costType: 'OPERATING_SERVICE', serviceName: '임차료', vendor: '건물주', monthlyCost: 15000000, paymentDate: '매월 1일' },
        { id: 'fcl-4', accountId: 'sga-fix-4', costType: 'OPERATING_SERVICE', serviceName: '공과금/관리비', vendor: '관리사무소', monthlyCost: 3000000, paymentDate: '매월 5일' },
        { id: 'fcl-5', accountId: 'sga-fix-5', costType: 'ASSET_FINANCE', serviceName: '감가상각/장비리스', vendor: '장비업체', monthlyCost: 5000000, paymentDate: '매월 15일', leaseTermMonths: 36, contractStartDate: '2025-01-01', contractEndDate: '2027-12-31' },
    ]
};

const initialDb: DB = {
    users: [
        { id: 'superadmin', password: 'adminpass', name: 'Super Admin', email: 'admin@system.com', role: 'superAdmin' },
        { id: 'user1', password: 'userpass', name: '김담당', email: 'user1@hospital.com', role: 'generalAdmin', tenantIds: ['tenant-1'] },
    ],
    tenants: [
        { id: 'tenant-1', name: '강남 A 피부과' },
        { id: 'tenant-2', name: '부산 B 의원' }
    ],
    financialData: {
        'tenant-1': JSON.parse(JSON.stringify(initialFinancials)),
        'tenant-2': JSON.parse(JSON.stringify(initialFinancials)), // Start with same template
    }
};

// 최신 템플릿 버전으로 기본 시스템 설정을 생성
function createDefaultSystemSettings(): SystemSettings {
    return {
        tenantTemplate: {
            version: TEMPLATE_VERSION,
            accountGroups: JSON.parse(JSON.stringify(initialFinancials.accountGroups)),
            accounts: JSON.parse(JSON.stringify(initialFinancials.accounts)),
            fixedCostLedger: JSON.parse(JSON.stringify(initialFinancials.fixedCostLedger)),
            initialMonths: ['2025-08'], // 기본으로 제공할 월
            manualDataDefaults: {},
            transactionDataDefaults: {}
        },
        branding: {
            systemName: '병원 재무 관리 시스템'
        }
    };
}

// 템플릿을 사용하여 새로운 Financials 객체 생성
function createFinancialsFromTemplate(template: SystemSettings['tenantTemplate']): Financials {
    return {
        accounts: JSON.parse(JSON.stringify(template.accounts)),
        accountGroups: JSON.parse(JSON.stringify(template.accountGroups)),
        transactionData: template.transactionDataDefaults ? JSON.parse(JSON.stringify(template.transactionDataDefaults)) : {},
        manualData: template.manualDataDefaults ? JSON.parse(JSON.stringify(template.manualDataDefaults)) : {},
        fixedCostLedger: JSON.parse(JSON.stringify(template.fixedCostLedger))
    };
}

class DatabaseService {
    private db: DB;

    constructor() {
        this.db = this.loadDB();
        this.initializeSettings();
    }

    private loadDB(): DB {
        if (typeof window === 'undefined') {
            return initialDb;
        }
        try {
            const serializedState = localStorage.getItem(DB_KEY);
            const schemaVersionKey = `${DB_KEY}_schema_version`;
            const storedSchemaVersion = localStorage.getItem(schemaVersionKey);

            // DB가 없으면 초기화
            if (serializedState === null) {
                console.log('Database not found. Initializing...');
                localStorage.setItem(schemaVersionKey, DB_SCHEMA_VERSION);
                this.saveDB(initialDb);
                return initialDb;
            }

            const db = JSON.parse(serializedState);

            // 스키마 버전이 다르면 전체 초기화 (구조 변경)
            if (storedSchemaVersion !== DB_SCHEMA_VERSION) {
                console.warn(`Schema version mismatch (${storedSchemaVersion} vs ${DB_SCHEMA_VERSION}). Full reset required.`);
                localStorage.setItem(schemaVersionKey, DB_SCHEMA_VERSION);
                this.saveDB(initialDb);
                return initialDb;
            }

            // 기존 사용자/병원 데이터 보존하고 settings만 체크
            return db;

        } catch (error) {
            console.error('Critical error parsing database. Full reset required.', error);
            localStorage.setItem(`${DB_KEY}_schema_version`, DB_SCHEMA_VERSION);
            return initialDb;
        }
    }

    private saveDB(db: DB) {
        if (typeof window !== 'undefined') {
            try {
                const serializedState = JSON.stringify(db);
                localStorage.setItem(DB_KEY, serializedState);
            } catch (error) {
                console.error('Error saving state to localStorage:', error);
            }
        }
    }

    // 안전한 템플릿 마이그레이션: 기존 병원 데이터는 보존, 템플릿만 업데이트
    private initializeSettings() {
        if (!this.db.settings) {
            // settings가 없으면 새로 생성
            console.log('Initializing settings with default template...');
            this.db.settings = createDefaultSystemSettings();
            this.saveDB(this.db);
        } else {
            // 템플릿 버전 체크하여 필요시 마이그레이션
            this.migrateTenantTemplate();
        }
    }

    // 템플릿만 선별 마이그레이션 (병원 데이터 무영향)
    private migrateTenantTemplate() {
        const currentTemplate = this.db.settings?.tenantTemplate;

        // 템플릿이 없거나 버전이 낮으면 업데이트
        if (!currentTemplate || !currentTemplate.version || currentTemplate.version !== TEMPLATE_VERSION) {
            console.log(`Migrating template from ${currentTemplate?.version || 'unknown'} to ${TEMPLATE_VERSION}`);

            // 기존 settings의 다른 설정들은 보존하고 tenantTemplate만 업데이트
            const newTemplate = createDefaultSystemSettings().tenantTemplate;
            this.db.settings!.tenantTemplate = newTemplate;

            console.log('Template migration completed. Hospital data preserved.');
            this.saveDB(this.db);
        } else {
            console.log(`Template version ${currentTemplate.version} is up to date.`);
        }
    }
    
    public init() {
      // The constructor already handles initialization.
    }

    public login(id: string, password?: string): User | null {
        const user = this.db.users.find(u => u.id === id && u.password === password);
        return user ? { id: user.id, name: user.name, email: user.email, role: user.role, tenantIds: user.tenantIds } : null;
    }

    public getFinancials(tenantId: string): Financials {
        if (!this.db.financialData[tenantId]) {
            // Create financial data for a new tenant if it doesn't exist
            this.db.financialData[tenantId] = JSON.parse(JSON.stringify(initialFinancials));
            this.saveDB(this.db);
        }
        return this.db.financialData[tenantId];
    }

    public saveFinancials(tenantId: string, financials: Financials): void {
        this.db.financialData[tenantId] = financials;
        this.saveDB(this.db);
    }
    
    public getUsers(): User[] {
        return this.db.users.map(({password, ...user}) => user); // Exclude password
    }
    
    public getTenants(): Tenant[] {
        return this.db.tenants;
    }

    public getTenant(tenantId: string): Tenant | null {
        return this.db.tenants.find(t => t.id === tenantId) || null;
    }
    
    public addUser(user: User): boolean {
        if (this.db.users.some(u => u.id === user.id || u.email === user.email)) {
            return false; // User already exists
        }
        this.db.users.push(user);
        this.saveDB(this.db);
        return true;
    }

    public updateUser(userId: string, updates: Partial<User>): boolean {
        const userIndex = this.db.users.findIndex(u => u.id === userId);
        if (userIndex === -1) {
            return false; // User not found
        }
        this.db.users[userIndex] = { ...this.db.users[userIndex], ...updates };
        this.saveDB(this.db);
        return true;
    }

    public addTenant(name: string): string | null {
        // Generate automatic UUID for tenant ID
        const newTenantId = crypto.randomUUID();

        // Check if name already exists (optional safeguard)
        if (this.db.tenants.some(t => t.name === name)) {
            return null; // Tenant with same name already exists
        }

        const newTenant: Tenant = {
            id: newTenantId,
            name: name
        };

        this.db.tenants.push(newTenant);
        // Initialize financial data for the new tenant using current template
        this.db.financialData[newTenantId] = createFinancialsFromTemplate(this.db.settings!.tenantTemplate);
        this.saveDB(this.db);
        return newTenantId; // Return the generated ID
    }

    public updateTenant(tenantId: string, updates: Partial<Tenant>): boolean {
        const tenantIndex = this.db.tenants.findIndex(t => t.id === tenantId);
        if (tenantIndex === -1) {
            return false; // Tenant not found
        }
        this.db.tenants[tenantIndex] = { ...this.db.tenants[tenantIndex], ...updates };
        this.saveDB(this.db);
        return true;
    }

    public deleteTenant(tenantId: string): boolean {
        const tenantIndex = this.db.tenants.findIndex(t => t.id === tenantId);
        if (tenantIndex === -1) {
            return false; // Tenant not found
        }
        // Remove tenant from tenants array
        this.db.tenants.splice(tenantIndex, 1);
        // Remove corresponding financial data
        delete this.db.financialData[tenantId];
        this.saveDB(this.db);
        return true;
    }

    public deleteUser(userId: string): boolean {
        const index = this.db.users.findIndex(u => u.id === userId);
        if (index === -1) return false;

        this.db.users.splice(index, 1);
        this.saveDB(this.db);
        return true;
    }

    public getUsersByTenantId(tenantId: string): User[] {
        return this.db.users
            .filter(user => user.tenantIds?.includes(tenantId))
            .map(({password, ...user}) => user); // Exclude password
    }

    // Settings 관련 메서드들
    public getSettings(): SystemSettings {
        if (!this.db.settings) {
            this.initializeSettings();
        }
        return this.db.settings!;
    }

    public saveSettings(settingsUpdates: Partial<SystemSettings>): boolean {
        try {
            if (!this.db.settings) {
                this.db.settings = createDefaultSystemSettings();
            }

            // Deep merge settings
            this.db.settings = {
                ...this.db.settings,
                ...settingsUpdates,
                tenantTemplate: settingsUpdates.tenantTemplate ? {
                    ...this.db.settings.tenantTemplate,
                    ...settingsUpdates.tenantTemplate,
                    // 템플릿 저장 시 항상 현재 버전으로 업데이트
                    version: TEMPLATE_VERSION
                } : this.db.settings.tenantTemplate
            };

            console.log(`Settings saved with template version ${TEMPLATE_VERSION}`);
            this.saveDB(this.db);
            return true;
        } catch (error) {
            console.error('Error saving settings:', error);
            return false;
        }
    }

    public resetSettingsToDefault(): boolean {
        try {
            this.db.settings = createDefaultSystemSettings();
            this.saveDB(this.db);
            return true;
        } catch (error) {
            console.error('Error resetting settings:', error);
            return false;
        }
    }

    // 템플릿에서 새로운 Financials 생성 (테스트용)
    public createFinancialsFromCurrentTemplate(): Financials {
        const settings = this.getSettings();
        return createFinancialsFromTemplate(settings.tenantTemplate);
    }
}

export default new DatabaseService();