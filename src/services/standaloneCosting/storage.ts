import axios from 'axios';
import {
  FixedCostGroup,
  FixedCostItem,
  OperationalConfig,
  OperationalScheduleMode,
  StandaloneCostingState,
  WeeklyOperationalSchedule,
  WeeklyScheduleEntry,
} from './types';

const API_PATH = '/api/standalone-costing';
const CURRENT_VERSION = 5;

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

const DEFAULT_WEEKS_PER_MONTH = 4.345;
const DAY_SEQUENCE: WeeklyScheduleEntry['day'][] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const TIME_PATTERN = /^([0-1]?\d|2[0-3]):([0-5]\d)$/;

const sanitizeTime = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  const match = TIME_PATTERN.exec(trimmed);
  if (!match) {
    return fallback;
  }
  const hour = String(Number(match[1])).padStart(2, '0');
  const minute = match[2];
  return `${hour}:${minute}`;
};

const toMinutes = (time: string): number => {
  const [hour, minute] = time.split(':');
  const hours = Number(hour);
  const minutes = Number(minute);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 0;
  }
  return hours * 60 + minutes;
};

const normalizeOperationalMode = (mode: unknown): OperationalScheduleMode => (mode === 'weekly' ? 'weekly' : 'simple');

const normalizeWeeklySchedule = (schedule: Partial<WeeklyOperationalSchedule> | undefined): WeeklyOperationalSchedule => {
  const baseWeeks =
    typeof schedule?.weeksPerMonth === 'number' && Number.isFinite(schedule.weeksPerMonth) && schedule.weeksPerMonth > 0
      ? schedule.weeksPerMonth
      : DEFAULT_WEEKS_PER_MONTH;

  const entriesMap = new Map<string, WeeklyScheduleEntry>();
  if (Array.isArray(schedule?.schedule)) {
    schedule?.schedule.forEach(entry => {
      if (entry && typeof entry.day === 'string') {
        entriesMap.set(entry.day, entry as WeeklyScheduleEntry);
      }
    });
  }

  const normalized: WeeklyScheduleEntry[] = DAY_SEQUENCE.map(day => {
    const existing = entriesMap.get(day);
    const startTime = sanitizeTime(existing?.startTime ?? null, '09:00');
    const endTime = sanitizeTime(existing?.endTime ?? null, '18:00');
    const duration = toMinutes(endTime) - toMinutes(startTime);
    const isOpen = Boolean(existing?.isOpen && duration > 0);
    return {
      day,
      isOpen,
      startTime,
      endTime,
    };
  });

  return {
    schedule: normalized,
    weeksPerMonth: baseWeeks,
  };
};

const normalizeOperationalConfig = (
  config:
    | (Partial<OperationalConfig> & {
        operatingDays?: unknown;
        operatingHoursPerDay?: unknown;
      })
    | undefined,
): OperationalConfig => {
  const safe = config ?? {};
  const simpleSource = safe.simple ?? {
    operatingDays: (safe as { operatingDays?: unknown }).operatingDays,
    operatingHoursPerDay: (safe as { operatingHoursPerDay?: unknown }).operatingHoursPerDay,
  };

  const simple = {
    operatingDays:
      typeof simpleSource?.operatingDays === 'number' && Number.isFinite(simpleSource.operatingDays)
        ? simpleSource.operatingDays
        : null,
    operatingHoursPerDay:
      typeof simpleSource?.operatingHoursPerDay === 'number' && Number.isFinite(simpleSource.operatingHoursPerDay)
        ? simpleSource.operatingHoursPerDay
        : null,
  };

  const bedInput = (safe as { bedCount?: unknown }).bedCount;
  const bedCount =
    typeof bedInput === 'number' && Number.isFinite(bedInput) && bedInput > 0 ? Math.floor(bedInput) : 1;

  return {
    mode: normalizeOperationalMode(safe.mode),
    simple,
    weekly: normalizeWeeklySchedule(safe.weekly),
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
