import { ConsumablePricingInput, CostingResultRow, InsightPayload, ProcedureVariantInput, BaselineStatus, StaffCapacityInput, FixedCostItemState } from '../types';

const STORAGE_KEY = 'costing.local.v1';

interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface StoredProcedureVariant {
  id: string;
  label: string;
  salePrice: number;
  totalMinutes: number;
  equipmentMinutes?: number | null;
  fixedCostTemplateId?: string | null;
  staffMix: ProcedureVariantInput['staffMix'];
  consumables: ProcedureVariantInput['consumables'];
  equipmentLinks: ProcedureVariantInput['equipmentLinks'];
}

interface StoredProcedureDefinition {
  id: string;
  name: string;
  variants: StoredProcedureVariant[];
}

interface StoredBaseline {
  id: string;
  tenantId: string | null;
  month: string;
  status: BaselineStatus;
  includeFixedCosts: boolean;
  appliedFixedCostIds: string[];
  lockedAt: string | null;
  lockedBy: string | null;
  lastCalculatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StoredResults {
  rows: CostingResultRow[];
  insights: InsightPayload;
  lastCalculatedAt: string | null;
}

interface StoredJob {
  jobId: string;
  baselineId: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED';
  queuedAt: string;
  completedAt?: string;
}

interface LocalCostingDB {
  baselines: Record<string, StoredBaseline>;
  staff: Record<string, StaffCapacityInput[]>;
  consumables: Record<string, ConsumablePricingInput[]>;
  procedures: Record<string, StoredProcedureDefinition[]>;
  fixedCostSelections: Record<string, { includeFixedCosts: boolean; items: FixedCostItemState[] }>;
  results: Record<string, StoredResults>;
  jobs: Record<string, StoredJob>;
  metadata: {
    version: number;
  };
}

const defaultDB: LocalCostingDB = {
  baselines: {},
  staff: {},
  consumables: {},
  procedures: {},
  fixedCostSelections: {},
  results: {},
  jobs: {},
  metadata: {
    version: 1,
  },
};

const inMemoryStore = new Map<string, string>();

const getStorage = (): StorageAdapter => {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    return window.localStorage;
  }
  return {
    getItem: key => inMemoryStore.get(key) ?? null,
    setItem: (key, value) => {
      inMemoryStore.set(key, value);
    },
    removeItem: key => {
      inMemoryStore.delete(key);
    },
  };
};

const storage = getStorage();

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const loadDB = (): LocalCostingDB => {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return clone(defaultDB);
    }
    const parsed = JSON.parse(raw) as LocalCostingDB;
    return {
      ...clone(defaultDB),
      ...parsed,
    };
  } catch (error) {
    console.warn('[Costing][LocalStorage] Failed to parse DB. Resetting.', error);
    storage.removeItem(STORAGE_KEY);
    return clone(defaultDB);
  }
};

const saveDB = (db: LocalCostingDB) => {
  storage.setItem(STORAGE_KEY, JSON.stringify(db));
};

const mutateDB = <T>(mutator: (db: LocalCostingDB) => T): T => {
  const db = loadDB();
  const result = mutator(db);
  saveDB(db);
  return result;
};

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `loc-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
};

const now = () => new Date().toISOString();

export const localDB = {
  load: loadDB,
  mutate: mutateDB,
  generateId,
  now,
  clone,
};

export type { StoredProcedureDefinition, StoredProcedureVariant, StoredBaseline, StoredResults, StoredJob, LocalCostingDB };
