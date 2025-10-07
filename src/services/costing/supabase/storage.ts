import type { PostgrestError } from '@supabase/supabase-js';
import { getSupabaseClient } from '../../supabaseClient';
import {
  LocalCostingDB,
  defaultLocalCostingDB,
  StoredBaseline,
  StoredProcedureDefinition,
  StoredProcedureVariant,
  StoredResults,
  StoredJob,
} from '../local/storage';

const TABLE_NAME = 'standalone_costing_state';
const STATE_ID = 'standalone-costing-primary';
const STATE_VERSION = 1;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const now = () => new Date().toISOString();

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `sb-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
};

let cached: LocalCostingDB | null = null;

const createClientOrThrow = () => {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('[SupabaseCostingDB] Supabase client is not configured');
  }
  return client;
};

const normalizeState = (raw: unknown): LocalCostingDB => {
  const merged = {
    ...clone(defaultLocalCostingDB),
    ...(raw && typeof raw === 'object' ? raw : {}),
  } as LocalCostingDB;
  return merged;
};

const loadFromRemote = async (): Promise<LocalCostingDB> => {
  const supabase = createClientOrThrow();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('state')
    .eq('id', STATE_ID)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('[SupabaseCostingDB] Failed to fetch state', error);
    throw error;
  }

  if (!data) {
    const initial = clone(defaultLocalCostingDB);
    await saveToRemote(initial);
    cached = clone(initial);
    return clone(initial);
  }

  const normalized = normalizeState(data.state);
  cached = clone(normalized);
  return clone(normalized);
};

const saveToRemote = async (db: LocalCostingDB): Promise<void> => {
  const supabase = createClientOrThrow();
  const { error } = await supabase
    .from(TABLE_NAME)
    .upsert({
      id: STATE_ID,
      state: db,
      version: STATE_VERSION,
    });

  if (error) {
    console.error('[SupabaseCostingDB] Failed to persist state', error);
    throw error;
  }
};

export const supabaseCostingDB = {
  async load(): Promise<LocalCostingDB> {
    if (cached) {
      return clone(cached);
    }
    try {
      return await loadFromRemote();
    } catch (error) {
      console.error('[SupabaseCostingDB] load() failed; returning default state', error);
      const fallback = clone(defaultLocalCostingDB);
      cached = clone(fallback);
      return fallback;
    }
  },

  async mutate<T>(mutator: (db: LocalCostingDB) => T | Promise<T>): Promise<T> {
    const db = await this.load();
    const result = await mutator(db);
    await saveToRemote(db).catch((error: PostgrestError | Error) => {
      console.error('[SupabaseCostingDB] mutate() persistence failed', error);
      throw error;
    });
    cached = clone(db);
    return result;
  },

  clone,
  now,
  generateId,
};

export type {
  StoredBaseline,
  StoredProcedureDefinition,
  StoredProcedureVariant,
  StoredResults,
  StoredJob,
  LocalCostingDB,
};
