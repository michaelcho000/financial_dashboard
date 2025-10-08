import axios from 'axios';
import { FixedCostGroup, FixedCostItem, OperationalConfig, StandaloneCostingState } from './types';

const API_PATH = '/api/standalone-costing';
const CURRENT_VERSION = 4;

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

const normalizeOperationalConfig = (config: Partial<OperationalConfig> | undefined): OperationalConfig => {
  const safe = config ?? {};
  const operatingDays =
    typeof safe.operatingDays === 'number' && Number.isFinite(safe.operatingDays) ? safe.operatingDays : null;
  const operatingHoursPerDay =
    typeof safe.operatingHoursPerDay === 'number' && Number.isFinite(safe.operatingHoursPerDay)
      ? safe.operatingHoursPerDay
      : null;
  const bedInput = safe.bedCount;
  const bedCount =
    typeof bedInput === 'number' && Number.isFinite(bedInput) && bedInput > 0 ? Math.floor(bedInput) : 1;

  return {
    operatingDays,
    operatingHoursPerDay,
    bedCount,
    notes: safe.notes ?? undefined,
  };
};

const ensureStateShape = (state: PartialState): StandaloneCostingState => ({
  operational: normalizeOperationalConfig(state.operational),
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

export const loadDraft = async (): Promise<LoadedDraftResult | null> => {
  try {
    const response = await axios.get(API_PATH);
    const { state, version } = response.data ?? {};
    if (!state) {
      return null;
    }

    const resolvedVersion = typeof version === 'number' ? version : 1;
    if (resolvedVersion > CURRENT_VERSION) {
      return null;
    }

    if (resolvedVersion === CURRENT_VERSION) {
      return { state: normalizeState(state), migrated: false };
    }

    const migratedState = migrateState(state, resolvedVersion);
    return { state: migratedState, migrated: true };
  } catch (error) {
    console.error('[StandaloneCosting] Failed to load draft', error);
    return null;
  }
};

export const saveDraft = async (state: StandaloneCostingState): Promise<void> => {
  try {
    await axios.post(API_PATH, {
      state,
      version: CURRENT_VERSION,
    });
  } catch (error) {
    console.error('[StandaloneCosting] Failed to save draft', error);
  }
};

export const clearDraft = async (): Promise<void> => {
  try {
    await axios.delete(API_PATH);
  } catch (error) {
    console.error('[StandaloneCosting] Failed to clear draft', error);
  }
};
