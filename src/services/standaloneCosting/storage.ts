import axios from 'axios';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import {
  CostingPhaseId,
  CostingPhaseStatus,
  FixedCostGroup,
  FixedCostItem,
  MarketingSettings,
  OperationalConfig,
  OperationalScheduleMode,
  ProcedureActualPerformance,
  StandaloneCostingState,
  StaffProfile,
  StaffWorkPattern,
  WeeklyOperationalSchedule,
  WeeklyScheduleEntry,
} from './types';
import { getSupabaseClient, hasSupabaseConfig } from '../supabaseClient';

export interface LoadedDraftResult {
  state: StandaloneCostingState;
  migrated: boolean;
}

type PartialState = Partial<StandaloneCostingState>;

const API_PATH = '/api/standalone-costing';
const CURRENT_VERSION = 10;
const SUPABASE_TABLE = 'standalone_costing_state';
const SUPABASE_ROW_ID = 'standalone-costing-primary';

const resolveSupabaseClient = (): SupabaseClient | null => {
  if (!hasSupabaseConfig()) {
    return null;
  }
  return getSupabaseClient();
};

const loadDraftViaSupabase = async (client: SupabaseClient): Promise<LoadedDraftResult | null> => {
  const { data, error } = await client
    .from(SUPABASE_TABLE)
    .select('state, version')
    .eq('id', SUPABASE_ROW_ID)
    .maybeSingle();

  if (error && (error as PostgrestError).code !== 'PGRST116') {
    throw error;
  }

  if (!data || !data.state) {
    return null;
  }

  const resolvedVersion = typeof data.version === 'number' ? data.version : 1;
  if (resolvedVersion > CURRENT_VERSION) {
    return null;
  }

  if (resolvedVersion === CURRENT_VERSION) {
    return { state: normalizeState(data.state as PartialState), migrated: false };
  }

  const migratedState = migrateState(data.state as PartialState, resolvedVersion);
  return { state: migratedState, migrated: true };
};

const saveDraftViaSupabase = async (client: SupabaseClient, state: StandaloneCostingState): Promise<void> => {
  const { error } = await client
    .from(SUPABASE_TABLE)
    .upsert({
      id: SUPABASE_ROW_ID,
      state,
      version: CURRENT_VERSION,
    });

  if (error) {
    throw error;
  }
};

const clearDraftViaSupabase = async (client: SupabaseClient): Promise<void> => {
  const { error } = await client
    .from(SUPABASE_TABLE)
    .delete()
    .eq('id', SUPABASE_ROW_ID);

  if (error && (error as PostgrestError).code !== 'PGRST116') {
    throw error;
  }
};

const loadDraftViaApi = async (): Promise<LoadedDraftResult | null> => {
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

const saveDraftViaApi = async (state: StandaloneCostingState): Promise<void> => {
  try {
    await axios.post(API_PATH, {
      state,
      version: CURRENT_VERSION,
    });
  } catch (error) {
    console.error('[StandaloneCosting] Failed to save draft', error);
  }
};

const clearDraftViaApi = async (): Promise<void> => {
  try {
    await axios.delete(API_PATH);
  } catch (error) {
    console.error('[StandaloneCosting] Failed to clear draft', error);
  }
};

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
const MINUTES_IN_HOUR = 60;
const DEFAULT_OPEN_START = '10:00';
const DEFAULT_OPEN_END = '19:00';
const DAY_SEQUENCE: WeeklyScheduleEntry['day'][] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const TIME_PATTERN = /^([0-1]?\d|2[0-3]):([0-5]\d)$/;
const CALENDAR_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const COSTING_PHASES: CostingPhaseId[] = [
  'operational',
  'staff',
  'materials',
  'fixedCosts',
  'procedures',
  'catalog',
  'results',
  'marketing',
];

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

const getDefaultCalendarMonth = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const sanitizeCalendarMonth = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return CALENDAR_MONTH_PATTERN.test(trimmed) ? trimmed : null;
};

const buildDefaultPhaseStatuses = (): Record<CostingPhaseId, CostingPhaseStatus> => {
  return COSTING_PHASES.reduce((acc, phase) => {
    acc[phase] = { lastSavedAt: null, checksum: null };
    return acc;
  }, {} as Record<CostingPhaseId, CostingPhaseStatus>);
};

const normalizePhaseStatuses = (
  value: Partial<Record<CostingPhaseId, CostingPhaseStatus>> | undefined,
): Record<CostingPhaseId, CostingPhaseStatus> => {
  const base = buildDefaultPhaseStatuses();
  if (!value || typeof value !== 'object') {
    return base;
  }
  COSTING_PHASES.forEach(phase => {
    const status = value[phase];
    if (status && typeof status === 'object') {
      base[phase] = {
        lastSavedAt: typeof status.lastSavedAt === 'string' ? status.lastSavedAt : null,
        checksum: typeof status.checksum === 'string' ? status.checksum : null,
      };
    }
  });
  return base;
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
    const startTime = sanitizeTime(existing?.startTime ?? null, DEFAULT_OPEN_START);
    const endTime = sanitizeTime(existing?.endTime ?? null, DEFAULT_OPEN_END);
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
    calendarMonth: sanitizeCalendarMonth(schedule?.calendarMonth) ?? getDefaultCalendarMonth(),
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

const sanitizePositiveNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
};

const sanitizeNonNegativeNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  if (value === '' || value === null || typeof value === 'undefined') {
    return 0;
  }
  return null;
};

const sanitizeOptionalNonNegativeNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return null;
};

const sanitizeMonthlyPattern = (
  input: Partial<StaffWorkPattern['monthly']> | null | undefined,
): StaffWorkPattern['monthly'] => {
  if (!input) {
    return null;
  }
  const days = sanitizePositiveNumber((input as { workDaysPerMonth?: unknown }).workDaysPerMonth);
  const hours = sanitizePositiveNumber((input as { workHoursPerDay?: unknown }).workHoursPerDay);
  if (!days || !hours) {
    return null;
  }
  return {
    workDaysPerMonth: days,
    workHoursPerDay: hours,
  };
};

const sanitizeWeeklyPattern = (
  input: Partial<StaffWorkPattern['weekly']> | null | undefined,
): StaffWorkPattern['weekly'] => {
  if (!input) {
    return null;
  }
  const daysPerWeek = sanitizePositiveNumber((input as { workDaysPerWeek?: unknown }).workDaysPerWeek);
  const hoursPerWeek = sanitizePositiveNumber((input as { workHoursPerWeek?: unknown }).workHoursPerWeek);
  const hoursPerDay = sanitizePositiveNumber((input as { workHoursPerDay?: unknown }).workHoursPerDay);
  if (!daysPerWeek && !hoursPerWeek && !hoursPerDay) {
    return null;
  }
  return {
    workDaysPerWeek: daysPerWeek ?? 0,
    workHoursPerWeek: hoursPerWeek ?? null,
    workHoursPerDay: hoursPerDay ?? null,
  };
};

const sanitizeDailyPattern = (
  input: Partial<StaffWorkPattern['daily']> | null | undefined,
): StaffWorkPattern['daily'] => {
  if (!input) {
    return null;
  }
  const days = sanitizePositiveNumber((input as { workDaysPerWeek?: unknown }).workDaysPerWeek);
  const hours = sanitizePositiveNumber((input as { workHoursPerDay?: unknown }).workHoursPerDay);
  if (!days || !hours) {
    return null;
  }
  return {
    workDaysPerWeek: days,
    workHoursPerDay: hours,
  };
};

const deriveMonthlyMinutesFromPattern = (
  pattern: StaffWorkPattern,
  fallbackEffectiveWeeks: number,
): { monthlyMinutes: number; weeklyMinutes: number | null } => {
  const effectiveWeeks =
    typeof pattern.effectiveWeeksPerMonth === 'number' && Number.isFinite(pattern.effectiveWeeksPerMonth)
      ? pattern.effectiveWeeksPerMonth
      : fallbackEffectiveWeeks;

  if (pattern.basis === 'monthly' && pattern.monthly) {
    const monthlyMinutes =
      pattern.monthly.workDaysPerMonth * pattern.monthly.workHoursPerDay * MINUTES_IN_HOUR;
    const weeklyMinutes = effectiveWeeks > 0 ? monthlyMinutes / effectiveWeeks : null;
    return { monthlyMinutes, weeklyMinutes };
  }

  if (pattern.basis === 'weekly' && pattern.weekly) {
    const hoursPerWeek =
      pattern.weekly.workHoursPerWeek ??
      (pattern.weekly.workHoursPerDay ? pattern.weekly.workHoursPerDay * (pattern.weekly.workDaysPerWeek || 0) : null);
    if (!hoursPerWeek) {
      return { monthlyMinutes: 0, weeklyMinutes: null };
    }
    const weeklyMinutes = hoursPerWeek * MINUTES_IN_HOUR;
    const monthlyMinutes = effectiveWeeks > 0 ? weeklyMinutes * effectiveWeeks : weeklyMinutes * fallbackEffectiveWeeks;
    return { monthlyMinutes, weeklyMinutes };
  }

  if (pattern.basis === 'daily' && pattern.daily) {
    const weeklyMinutes =
      pattern.daily.workDaysPerWeek * pattern.daily.workHoursPerDay * MINUTES_IN_HOUR;
    const monthlyMinutes = effectiveWeeks > 0 ? weeklyMinutes * effectiveWeeks : weeklyMinutes * fallbackEffectiveWeeks;
    return { monthlyMinutes, weeklyMinutes };
  }

  return { monthlyMinutes: 0, weeklyMinutes: null };
};

const normalizeStaffWorkPattern = (
  profile: StaffProfile,
  fallbackEffectiveWeeks: number,
): StaffWorkPattern => {
  const legacyMonthly = sanitizeMonthlyPattern({
    workDaysPerMonth: profile.workDaysPerMonth,
    workHoursPerDay: profile.workHoursPerDay,
  });

  const rawPattern = profile.workPattern ?? null;
  const monthly =
    sanitizeMonthlyPattern(rawPattern?.monthly) ?? legacyMonthly;
  const weekly = sanitizeWeeklyPattern(rawPattern?.weekly);
  const daily = sanitizeDailyPattern(rawPattern?.daily);

  let basis: StaffWorkPattern['basis'] = 'monthly';
  if (rawPattern?.basis === 'weekly' && weekly) {
    basis = 'weekly';
  } else if (rawPattern?.basis === 'daily' && daily) {
    basis = 'daily';
  } else if (rawPattern?.basis === 'monthly' && monthly) {
    basis = 'monthly';
  } else if (!monthly && weekly) {
    basis = 'weekly';
  } else if (!monthly && !weekly && daily) {
    basis = 'daily';
  }

  const effectiveWeeks =
    sanitizePositiveNumber(rawPattern?.effectiveWeeksPerMonth) ?? fallbackEffectiveWeeks;

  const pattern: StaffWorkPattern = {
    basis,
    monthly,
    weekly,
    daily,
    effectiveWeeksPerMonth: effectiveWeeks,
    derivedMonthlyMinutes: 0,
    derivedWeeklyMinutes: null,
  };

  const derived = deriveMonthlyMinutesFromPattern(pattern, fallbackEffectiveWeeks);
  pattern.derivedMonthlyMinutes = derived.monthlyMinutes;
  pattern.derivedWeeklyMinutes = derived.weeklyMinutes;

  return pattern;
};

const normalizeStaffProfile = (profile: StaffProfile): StaffProfile => {
  const normalizedWorkDaysPerMonth =
    typeof profile.workDaysPerMonth === 'number' && Number.isFinite(profile.workDaysPerMonth)
      ? profile.workDaysPerMonth
      : 0;
  const normalizedWorkHoursPerDay =
    typeof profile.workHoursPerDay === 'number' && Number.isFinite(profile.workHoursPerDay)
      ? profile.workHoursPerDay
      : 0;

  const workPattern = normalizeStaffWorkPattern(
    {
      ...profile,
      workDaysPerMonth: normalizedWorkDaysPerMonth,
      workHoursPerDay: normalizedWorkHoursPerDay,
    },
    DEFAULT_WEEKS_PER_MONTH,
  );

  return {
    ...profile,
    workDaysPerMonth: normalizedWorkDaysPerMonth,
    workHoursPerDay: normalizedWorkHoursPerDay,
    workPattern,
  };
};

const normalizeStaffList = (staff: StaffProfile[] | undefined): StaffProfile[] => {
  if (!Array.isArray(staff)) {
    return [];
  }
  return staff.map(normalizeStaffProfile);
};

const sanitizeMarketingAllocationMap = (value: unknown): Record<string, number> => {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const result: Record<string, number> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, raw]) => {
    if (typeof key !== 'string' || key.trim().length === 0) {
      return;
    }
    const normalized = sanitizeOptionalNonNegativeNumber(raw);
    if (normalized !== null) {
      result[key] = normalized;
    }
  });
  return result;
};

const normalizeMarketingSettings = (
  value: Partial<MarketingSettings> | undefined,
): MarketingSettings => {
  const targetRevenue = sanitizeOptionalNonNegativeNumber(value?.targetRevenue);
  const manualMarketingBudget = sanitizeOptionalNonNegativeNumber(value?.manualMarketingBudget);
  const manualMarketingAllocations = sanitizeMarketingAllocationMap(
    (value as { manualMarketingAllocations?: unknown })?.manualMarketingAllocations,
  );
  return {
    targetRevenue,
    manualMarketingBudget,
    manualMarketingAllocations,
  };
};

const normalizeProcedureActuals = (
  items: Partial<ProcedureActualPerformance>[] | undefined,
): ProcedureActualPerformance[] => {
  if (!Array.isArray(items)) {
    return [];
  }
  const seen = new Set<string>();
  const normalized: ProcedureActualPerformance[] = [];
  items.forEach(item => {
    if (!item || typeof item !== 'object') {
      return;
    }
    const procedureId =
      typeof item.procedureId === 'string' && item.procedureId.trim().length > 0 ? item.procedureId.trim() : null;
    if (!procedureId || seen.has(procedureId)) {
      return;
    }
    const performed = sanitizeNonNegativeNumber((item as { performed?: unknown }).performed);
    const marketingSpend = sanitizeNonNegativeNumber((item as { marketingSpend?: unknown }).marketingSpend);
    normalized.push({
      procedureId,
      performed: performed ?? 0,
      marketingSpend: marketingSpend ?? null,
      notes: typeof item.notes === 'string' && item.notes.trim() ? item.notes.trim() : undefined,
    });
    seen.add(procedureId);
  });
  return normalized;
};

const ensureStateShape = (state: PartialState): StandaloneCostingState => ({
  operational: normalizeOperationalConfig(state.operational),
  equipment: state.equipment ?? [],
  useEquipmentHierarchy: state.useEquipmentHierarchy ?? false,
  staff: normalizeStaffList(state.staff),
  phaseStatuses: normalizePhaseStatuses(state.phaseStatuses),
  materials: state.materials ?? [],
  fixedCosts: state.fixedCosts ?? [],
  procedures: state.procedures ?? [],
  breakdowns: state.breakdowns ?? [],
  procedureActuals: normalizeProcedureActuals(state.procedureActuals as Partial<ProcedureActualPerformance>[] | undefined),
  marketingSettings: normalizeMarketingSettings(state.marketingSettings as Partial<MarketingSettings> | undefined),
  lastSavedAt: state.lastSavedAt ?? null,
});

const normalizeState = (state: PartialState): StandaloneCostingState => {
  const ensured = ensureStateShape(state);
  return {
    ...ensured,
    fixedCosts: ensured.fixedCosts.map(normalizeFixedCost),
    staff: normalizeStaffList(ensured.staff),
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

  if (version < 8) {
    next = {
      ...next,
      procedureActuals: normalizeProcedureActuals(
        (next.procedureActuals as Partial<ProcedureActualPerformance>[] | undefined) ?? [],
      ),
    };
  }

  if (version < 9) {
    next = {
      ...next,
      marketingSettings: normalizeMarketingSettings(next.marketingSettings as Partial<MarketingSettings> | undefined),
    };
  }

  return normalizeState(next);
};

export const loadDraft = async (): Promise<LoadedDraftResult | null> => {
  const supabase = resolveSupabaseClient();
  if (supabase) {
    try {
      return await loadDraftViaSupabase(supabase);
    } catch (error) {
      console.error('[StandaloneCosting] Supabase load failed, falling back to API', error);
    }
  }

  return loadDraftViaApi();
};

export const saveDraft = async (state: StandaloneCostingState): Promise<void> => {
  const supabase = resolveSupabaseClient();
  if (supabase) {
    try {
      await saveDraftViaSupabase(supabase, state);
      return;
    } catch (error) {
      console.error('[StandaloneCosting] Supabase save failed, falling back to API', error);
    }
  }

  await saveDraftViaApi(state);
};

export const clearDraft = async (): Promise<void> => {
  const supabase = resolveSupabaseClient();
  if (supabase) {
    try {
      await clearDraftViaSupabase(supabase);
      return;
    } catch (error) {
      console.error('[StandaloneCosting] Supabase clear failed, falling back to API', error);
    }
  }

  await clearDraftViaApi();
};
