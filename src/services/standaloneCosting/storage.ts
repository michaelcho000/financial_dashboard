import { FixedCostGroup, FixedCostItem, StandaloneCostingDraft, StandaloneCostingState } from './types';

const STORAGE_KEY = 'standaloneCosting.v1';
const CURRENT_VERSION = 3;

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export interface LoadedDraftResult {
  state: StandaloneCostingState;
  migrated: boolean;
}

type PartialState = Partial<StandaloneCostingState>;

const normalizeFixedCost = (item: FixedCostItem & { costGroup?: string; category?: string }): FixedCostItem => {
  const normalizedGroup: FixedCostGroup =
    item.costGroup === 'common' || item.costGroup === 'marketing'
      ? (item.costGroup as FixedCostGroup)
      : 'facility';

  const parsedAmount = Number((item as { monthlyAmount?: unknown }).monthlyAmount);
  const monthlyAmount = Number.isFinite(parsedAmount) ? parsedAmount : 0;

  return {
    id: item.id,
    name: item.name,
    monthlyAmount,
    notes: item.notes,
    costGroup: normalizedGroup,
  };
};

const ensureStateShape = (state: PartialState): StandaloneCostingState => ({
  operational: state.operational ?? { operatingDays: null, operatingHoursPerDay: null, notes: undefined },
  equipment: state.equipment ?? [],
  useEquipmentHierarchy: state.useEquipmentHierarchy ?? false,
  staff: state.staff ?? [],
  materials: state.materials ?? [],
  fixedCosts: state.fixedCosts ?? [],
  procedures: state.procedures ?? [],
  breakdowns: state.breakdowns ?? [],
  lastSavedAt: state.lastSavedAt ?? null,
});

const normalizeState = (state: PartialState): StandaloneCostingState => {
  const ensured = ensureStateShape(state);
  return {
    ...ensured,
    fixedCosts: ensured.fixedCosts.map(normalizeFixedCost),
  };
};

const migrateState = (state: PartialState, version: number): StandaloneCostingState => {
  if (version >= CURRENT_VERSION) {
    return normalizeState(state);
  }

  let next: PartialState = { ...state };

  if (version < 2) {
    const fixedCosts = Array.isArray(next.fixedCosts) ? next.fixedCosts : [];
    next = {
      ...next,
      fixedCosts: fixedCosts.map(item => ({
        ...(item as FixedCostItem),
        costGroup: (item as FixedCostItem)?.costGroup === 'common' ? 'common' : 'facility',
      })),
    };
  }

  return normalizeState(next);
};

export const loadDraft = (): LoadedDraftResult | null => {
  if (!isBrowser) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StandaloneCostingDraft> & { version?: number };
    if (!parsed || typeof parsed !== 'object' || !parsed.state) {
      return null;
    }

    const version = typeof parsed.version === 'number' ? parsed.version : 1;
    if (version > CURRENT_VERSION) {
      return null;
    }

    if (version === CURRENT_VERSION) {
      return { state: normalizeState(parsed.state), migrated: false };
    }

    const migratedState = migrateState(parsed.state, version);
    return { state: migratedState, migrated: true };
  } catch (error) {
    console.error('[StandaloneCosting] Failed to load draft', error);
    return null;
  }
};

export const saveDraft = (state: StandaloneCostingState): void => {
  if (!isBrowser) {
    return;
  }
  try {
    const payload: StandaloneCostingDraft = {
      state,
      version: CURRENT_VERSION,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.error('[StandaloneCosting] Failed to save draft', error);
  }
};

export const clearDraft = (): void => {
  if (!isBrowser) {
    return;
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('[StandaloneCosting] Failed to clear draft', error);
  }
};


