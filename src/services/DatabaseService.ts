import { AccountCategory, DB, Financials, SystemSettings, Tenant, User } from '../types';

const DB_KEY = 'financial_app_db';
const DB_SCHEMA_VERSION = '1.0.0'; // DB 스키마 버전 (필드 구조 변경시에만 증가)
const TEMPLATE_VERSION = '2.0.0'; // 템플릿 버전 (대표 계정 변경시 증가)

// 구버전 → 신버전 계정 매핑 테이블
const ACCOUNT_MIGRATION_MAP = {
    // 매출 계정 매핑
    'rev-1': 'rev-1', // 카드매출 → 비급여 일반수익
    'rev-2': 'rev-2', // 현금매출 → 멤버십/패키지
    'rev-4': 'rev-4', // 본인부담금 → 보험 본인부담금

    // 매출원가 계정 매핑
    'cogs-1': 'cogs-1', // 재료비 A → 시술 재료비

    // 고정비 계정 매핑
    'sga-fix-1': 'sga-fix-1', // 직원급여 → 관리직 인건비
    'sga-fix-2': 'sga-fix-2', // 4대보험 → 4대보험료
    'sga-fix-3': 'sga-fix-3', // 월 임차료 → 임차료

    // 변동비 계정 매핑
    'sga-var-1': 'sga-var-3', // 복리후생비 → 교육/복지비
    'sga-var-2': 'sga-var-1', // 마케팅비 → 마케팅/광고비
};

// 그룹명 매핑 테이블
const GROUP_MIGRATION_MAP = {
    '비급여': '비급여 수익',
    '보험급여': '보험 수익',
    '원재료비': '시술 원가',
    '지급임차료': '임차/관리',
    '기타': '기타 비용'
};

const initialFinancials: Financials = {
    templateVersion: TEMPLATE_VERSION,
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
        'tenant-1': (() => {
            const data = JSON.parse(JSON.stringify(initialFinancials));
            delete data.templateVersion; // 구버전 데이터로 시뮬레이션
            return data;
        })(),
        'tenant-2': (() => {
            const data = JSON.parse(JSON.stringify(initialFinancials));
            delete data.templateVersion; // 구버전 데이터로 시뮬레이션
            return data;
        })()
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
        templateVersion: template.version,
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

            // 템플릿 업데이트 후 기존 병원 데이터 마이그레이션 실행
            this.migrateAllTenantData();
        } else {
            console.log(`Template version ${currentTemplate.version} is up to date.`);
        }
    }

    // 모든 병원 데이터를 최신 템플릿 버전으로 마이그레이션
    private migrateAllTenantData() {
        console.log('Starting tenant data migration...');
        let successCount = 0;
        let failureCount = 0;

        Object.keys(this.db.financialData).forEach(tenantId => {
            try {
                const migrated = this.migrateTenantData(tenantId);
                if (migrated) {
                    successCount++;
                    console.log(`✅ Tenant ${tenantId} migrated successfully`);
                } else {
                    console.log(`ℹ️ Tenant ${tenantId} already up to date`);
                }
            } catch (error) {
                failureCount++;
                console.error(`❌ Failed to migrate tenant ${tenantId}:`, error);
            }
        });

        console.log(`Migration completed: ${successCount} updated, ${failureCount} failed`);
        if (failureCount > 0) {
            console.warn('Some tenants failed to migrate. Check logs for details.');
        }

        // 💾 중요: 마이그레이션 결과를 localStorage에 저장
        this.saveDB(this.db);
    }

    // 개별 병원 데이터 마이그레이션
    private migrateTenantData(tenantId: string): boolean {
        const financials = this.db.financialData[tenantId];
        if (!financials) return false;

        // 이미 최신 버전이면 스킵
        if (financials.templateVersion === TEMPLATE_VERSION) {
            return false;
        }

        console.log(`Migrating tenant ${tenantId} from version ${financials.templateVersion || 'unknown'}`);

        // 백업 생성
        this.createTenantBackup(tenantId, financials);

        // 계정 데이터 마이그레이션
        this.migrateAccounts(financials);

        // 그룹 데이터 마이그레이션
        this.migrateAccountGroups(financials);

        // 고정비 레저 마이그레이션
        this.migrateFixedCostLedger(financials);

        // 버전 업데이트
        financials.templateVersion = TEMPLATE_VERSION;

        return true;
    }

    // 계정 데이터 마이그레이션 (매핑 테이블 사용)
    private migrateAccounts(financials: Financials) {
        const newTemplate = this.getSettings().tenantTemplate;

        ['revenue', 'cogs', 'sgaFixed', 'sgaVariable'].forEach(category => {
            const accounts = financials.accounts[category as keyof typeof financials.accounts];
            const templateAccounts = newTemplate.accounts[category as keyof typeof newTemplate.accounts];

            accounts.forEach(account => {
                // 🔧 매핑 테이블을 사용하여 새 ID 찾기
                const mappedId = ACCOUNT_MIGRATION_MAP[account.id as keyof typeof ACCOUNT_MIGRATION_MAP] || account.id;
                const templateAccount = templateAccounts.find(ta => ta.id === mappedId);

                if (templateAccount) {
                    // 계정명과 그룹명을 템플릿 기준으로 업데이트
                    account.name = templateAccount.name;
                    account.group = templateAccount.group;
                    console.log(`  ✅ Account updated: ${account.id} → ${templateAccount.name}`);
                } else {
                    console.log(`  ⚠️ Template account not found for: ${account.id} (mapped to ${mappedId})`);
                }
            });

            // 🔧 새 템플릿에만 있는 계정들 추가
            templateAccounts.forEach(templateAccount => {
                const exists = accounts.find(acc => acc.id === templateAccount.id);
                if (!exists) {
                    accounts.push({...templateAccount});
                    console.log(`  ➕ New account added: ${templateAccount.id} - ${templateAccount.name}`);
                }
            });
        });
    }

    // 그룹 데이터 마이그레이션 (기존 커스텀 그룹 보존)
    private migrateAccountGroups(financials: Financials) {
        const newTemplate = this.getSettings().tenantTemplate;

        // 🔧 기존 커스텀 그룹 보존하면서 새 템플릿 그룹 병합
        ['revenue', 'cogs', 'sga'].forEach(category => {
            const existingGroups = financials.accountGroups[category as keyof typeof financials.accountGroups] || [];
            const templateGroups = newTemplate.accountGroups[category as keyof typeof newTemplate.accountGroups];

            // 기존 그룹명을 매핑된 이름으로 업데이트
            const updatedGroups = existingGroups.map(group =>
                GROUP_MIGRATION_MAP[group as keyof typeof GROUP_MIGRATION_MAP] || group
            );

            // 중복 제거하고 새 템플릿 그룹 추가
            const mergedGroups = [...new Set([...updatedGroups, ...templateGroups])];
            financials.accountGroups[category as keyof typeof financials.accountGroups] = mergedGroups;

            console.log(`  🔄 Groups updated for ${category}: ${mergedGroups.join(', ')}`);
        });
    }

    // 고정비 레저 마이그레이션
    private migrateFixedCostLedger(financials: Financials) {
        const newTemplate = this.getSettings().tenantTemplate;

        financials.fixedCostLedger.forEach(item => {
            // 매핑된 템플릿 아이템 찾기
            const templateItem = newTemplate.fixedCostLedger.find(ti => ti.accountId === item.accountId);
            if (templateItem) {
                // 서비스명을 템플릿 기준으로 업데이트
                item.serviceName = templateItem.serviceName;
            }
        });

        // 새 템플릿에서 추가된 고정비 항목이 있으면 추가
        newTemplate.fixedCostLedger.forEach(templateItem => {
            const exists = financials.fixedCostLedger.find(item => item.accountId === templateItem.accountId);
            if (!exists) {
                // 새로운 고정비 항목 추가
                financials.fixedCostLedger.push({
                    ...templateItem,
                    id: `migrated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                });
            }
        });
    }

    // 병원 데이터 백업 생성
    private createTenantBackup(tenantId: string, financials: Financials) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupKey = `${DB_KEY}_backup_${tenantId}_${timestamp}`;
            const backupData = {
                tenantId,
                timestamp,
                templateVersion: financials.templateVersion || 'unknown',
                data: JSON.parse(JSON.stringify(financials))
            };

            if (typeof window !== 'undefined') {
                localStorage.setItem(backupKey, JSON.stringify(backupData));
                console.log(`💾 Backup created for tenant ${tenantId}: ${backupKey}`);
            }
        } catch (error) {
            console.error(`Failed to create backup for tenant ${tenantId}:`, error);
        }
    }

    // 백업 목록 조회
    public getBackups(): Array<{key: string, tenantId: string, timestamp: string, templateVersion: string}> {
        if (typeof window === 'undefined') return [];

        const backups: Array<{key: string, tenantId: string, timestamp: string, templateVersion: string}> = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(`${DB_KEY}_backup_`)) {
                try {
                    const backupData = JSON.parse(localStorage.getItem(key) || '{}');
                    backups.push({
                        key,
                        tenantId: backupData.tenantId,
                        timestamp: backupData.timestamp,
                        templateVersion: backupData.templateVersion
                    });
                } catch (error) {
                    console.warn(`Invalid backup data in ${key}:`, error);
                }
            }
        }

        return backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    }

    // 백업에서 병원 데이터 복구
    public restoreFromBackup(backupKey: string): boolean {
        try {
            if (typeof window === 'undefined') return false;

            const backupData = localStorage.getItem(backupKey);
            if (!backupData) {
                console.error(`Backup not found: ${backupKey}`);
                return false;
            }

            const backup = JSON.parse(backupData);
            this.db.financialData[backup.tenantId] = backup.data;
            this.saveDB(this.db);

            console.log(`✅ Restored tenant ${backup.tenantId} from backup ${backupKey}`);
            return true;
        } catch (error) {
            console.error(`Failed to restore from backup ${backupKey}:`, error);
            return false;
        }
    }

    // 수동 마이그레이션 실행 (슈퍼관리자용)
    public runManualMigration(): {success: number, failed: number, results: Array<{tenantId: string, status: string, error?: string}>} {
        const results: Array<{tenantId: string, status: string, error?: string}> = [];
        let success = 0;
        let failed = 0;

        Object.keys(this.db.financialData).forEach(tenantId => {
            try {
                const migrated = this.migrateTenantData(tenantId);
                if (migrated) {
                    success++;
                    results.push({tenantId, status: 'migrated'});
                } else {
                    results.push({tenantId, status: 'already_up_to_date'});
                }
            } catch (error) {
                failed++;
                results.push({
                    tenantId,
                    status: 'failed',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        this.saveDB(this.db);
        return {success, failed, results};
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
            // 🔧 수정: 템플릿을 사용하여 신규 병원 데이터 생성
            const settings = this.getSettings();
            this.db.financialData[tenantId] = createFinancialsFromTemplate(settings.tenantTemplate);
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