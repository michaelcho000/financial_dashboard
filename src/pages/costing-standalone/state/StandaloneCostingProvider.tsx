import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { buildAllBreakdowns } from '../../../services/standaloneCosting/calculations';
import { clearDraft, loadDraft, saveDraft } from '../../../services/standaloneCosting/storage';
import {
  CostingPhaseId,
  CostingPhaseStatus,
  EquipmentProfile,
  FixedCostGroup,
  FixedCostItem,
  MaterialItem,
  OperationalConfig,
  OperationalScheduleMode,
  ProcedureActualPerformance,
  ProcedureFormValues,
  MarketingSettings,
  StandaloneCostingState,
  StaffProfile,
  StaffWorkPattern,
  WeeklyOperationalSchedule,
  WeeklyScheduleEntry,
} from '../../../services/standaloneCosting/types';

type StandaloneCostingAction =
  | { type: 'LOAD_STATE'; payload: StandaloneCostingState }
  | { type: 'RESET' }
  | { type: 'SET_OPERATIONAL'; payload: OperationalConfig }
  | { type: 'SET_EQUIPMENT_HIERARCHY'; payload: boolean }
  | { type: 'UPSERT_EQUIPMENT'; payload: EquipmentProfile }
  | { type: 'REMOVE_EQUIPMENT'; payload: { id: string } }
  | { type: 'UPSERT_STAFF'; payload: StaffProfile }
  | { type: 'REMOVE_STAFF'; payload: { id: string } }
  | { type: 'UPSERT_MATERIAL'; payload: MaterialItem }
  | { type: 'REMOVE_MATERIAL'; payload: { id: string } }
  | { type: 'UPSERT_FIXED_COST'; payload: FixedCostItem }
  | { type: 'REMOVE_FIXED_COST'; payload: { id: string } }
  | { type: 'UPSERT_PROCEDURE'; payload: ProcedureFormValues }
  | { type: 'REMOVE_PROCEDURE'; payload: { id: string } }
  | { type: 'SET_BREAKDOWNS' }
  | { type: 'UPSERT_PROCEDURE_ACTUAL'; payload: ProcedureActualPerformance }
  | { type: 'REMOVE_PROCEDURE_ACTUAL'; payload: { procedureId: string } }
  | { type: 'SET_MARKETING_SETTINGS'; payload: Partial<MarketingSettings> }
  | { type: 'MARK_PHASES_SAVED'; payload: { phases: Partial<Record<CostingPhaseId, CostingPhaseStatus>>; timestamp: string } };

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

const sanitizeOptionalNonNegative = (value: unknown): number | null => {
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

const normalizeMarketingSettings = (
  settings: Partial<MarketingSettings> | undefined,
): MarketingSettings => {
  return {
    targetRevenue: sanitizeOptionalNonNegative(settings?.targetRevenue),
    manualMarketingBudget: sanitizeOptionalNonNegative(settings?.manualMarketingBudget),
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

  const tempPattern: StaffWorkPattern = {
    basis,
    monthly,
    weekly,
    daily,
    effectiveWeeksPerMonth: effectiveWeeks,
    derivedMonthlyMinutes: 0,
    derivedWeeklyMinutes: null,
  };

  const derived = deriveMonthlyMinutesFromPattern(tempPattern, fallbackEffectiveWeeks);
  tempPattern.derivedMonthlyMinutes = derived.monthlyMinutes;
  tempPattern.derivedWeeklyMinutes = derived.weeklyMinutes;

  return tempPattern;
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

const normalizeStaffList = (staff: StaffProfile[]): StaffProfile[] => staff.map(normalizeStaffProfile);

const stableStringify = (value: unknown): string => {
  const seen = new WeakSet<object>();
  const normalize = (input: unknown): unknown => {
    if (input === null || typeof input !== 'object') {
      return input;
    }
    if (seen.has(input as object)) {
      return null;
    }
    seen.add(input as object);
    if (Array.isArray(input)) {
      return input.map(item => normalize(item));
    }
    const result: Record<string, unknown> = {};
    Object.keys(input as Record<string, unknown>)
      .sort()
      .forEach(key => {
        result[key] = normalize((input as Record<string, unknown>)[key]);
      });
    return result;
  };
  return JSON.stringify(normalize(value));
};

const phaseSnapshotSelectors: Record<CostingPhaseId, (state: StandaloneCostingState) => unknown> = {
  operational: state => ({
    operational: state.operational,
    equipment: state.equipment,
    useEquipmentHierarchy: state.useEquipmentHierarchy,
  }),
  staff: state => state.staff,
  materials: state => state.materials,
  fixedCosts: state => state.fixedCosts,
  procedures: state => state.procedures,
  catalog: state => state.procedures,
  results: state => ({
    breakdowns: state.breakdowns,
    procedures: state.procedures.map(item => ({ id: item.id, totalMinutes: item.totalMinutes })),
  }),
  marketing: state => ({
    breakdowns: state.breakdowns,
    procedures: state.procedures.map(item => ({ id: item.id, price: item.price })),
    marketingSettings: state.marketingSettings,
    procedureActuals: state.procedureActuals,
  }),
};

const computePhaseChecksum = (state: StandaloneCostingState, phase: CostingPhaseId): string => {
  const selector = phaseSnapshotSelectors[phase];
  const snapshot = selector ? selector(state) : null;
  return stableStringify(snapshot);
};

const PHASE_SAVE_PROPAGATION: Partial<Record<CostingPhaseId, CostingPhaseId[]>> = {
  operational: ['results', 'marketing'],
  staff: ['results', 'marketing'],
  materials: ['results', 'marketing'],
  fixedCosts: ['results', 'marketing'],
  procedures: ['catalog', 'results', 'marketing'],
};

const seedPhaseChecksums = (
  state: StandaloneCostingState,
  timestamp: string | null = null,
): StandaloneCostingState => {
  const nextStatuses = { ...state.phaseStatuses };
  let changed = false;
  COSTING_PHASES.forEach(phase => {
    const existing = nextStatuses[phase] ?? { lastSavedAt: null, checksum: null };
    if (!existing.checksum) {
      nextStatuses[phase] = {
        lastSavedAt: existing.lastSavedAt ?? timestamp,
        checksum: computePhaseChecksum(state, phase),
      };
      changed = true;
    }
  });
  if (!changed) {
    return state;
  }
  return {
    ...state,
    phaseStatuses: nextStatuses,
  };
};

const normalizeOperationalMode = (mode: unknown): OperationalScheduleMode => {
  return mode === 'weekly' ? 'weekly' : 'simple';
};

const normalizeWeeklySchedule = (schedule: Partial<WeeklyOperationalSchedule> | undefined): WeeklyOperationalSchedule => {
  const baseWeeks =
    typeof schedule?.weeksPerMonth === 'number' && Number.isFinite(schedule.weeksPerMonth) && schedule.weeksPerMonth > 0
      ? schedule.weeksPerMonth
      : DEFAULT_WEEKS_PER_MONTH;

  const entriesByDay = new Map<string, WeeklyScheduleEntry>();
  if (Array.isArray(schedule?.schedule)) {
    schedule?.schedule.forEach(entry => {
      if (entry && typeof entry.day === 'string') {
        entriesByDay.set(entry.day, entry as WeeklyScheduleEntry);
      }
    });
  }

  const normalized: WeeklyScheduleEntry[] = DAY_SEQUENCE.map(day => {
    const existing = entriesByDay.get(day);
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
  const normalizedBedCount =
    typeof bedInput === 'number' && Number.isFinite(bedInput) && bedInput > 0 ? Math.floor(bedInput) : 1;

  return {
    mode: normalizeOperationalMode(safe.mode),
    simple,
    weekly: normalizeWeeklySchedule(safe.weekly),
    bedCount: normalizedBedCount,
    notes: safe.notes ?? undefined,
  };
};

const buildInitialState = (): StandaloneCostingState => {
  const base: StandaloneCostingState = {
    operational: normalizeOperationalConfig(undefined),
    equipment: [],
    useEquipmentHierarchy: false,
    staff: [],
    phaseStatuses: buildDefaultPhaseStatuses(),
  materials: [],
  fixedCosts: [],
  procedures: [],
  breakdowns: [],
  marketingSettings: {
    targetRevenue: null,
    manualMarketingBudget: null,
  },
  procedureActuals: [],
  lastSavedAt: null,
};
  return seedPhaseChecksums(base);
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

const normalizeFixedCosts = (items: FixedCostItem[]): FixedCostItem[] => items.map(normalizeFixedCost);

const recalcBreakdowns = (state: StandaloneCostingState, touchTimestamp = true): StandaloneCostingState => {
  const normalizedStaff = normalizeStaffList(state.staff);
  const normalizedFixedCosts = normalizeFixedCosts(state.fixedCosts);
  const normalizedOperational = normalizeOperationalConfig(state.operational);
  const breakdowns = buildAllBreakdowns(state.procedures, {
    staff: normalizedStaff,
    materials: state.materials,
    fixedCosts: normalizedFixedCosts,
    operational: normalizedOperational,
  });

  return {
    ...state,
    staff: normalizedStaff,
    fixedCosts: normalizedFixedCosts,
    operational: normalizedOperational,
    marketingSettings: normalizeMarketingSettings(state.marketingSettings),
    breakdowns,
    phaseStatuses: normalizePhaseStatuses(state.phaseStatuses),
    lastSavedAt: touchTimestamp ? new Date().toISOString() : state.lastSavedAt,
  };
};

const reducer = (state: StandaloneCostingState, action: StandaloneCostingAction): StandaloneCostingState => {
  switch (action.type) {
    case 'LOAD_STATE': {
      const seeded = recalcBreakdowns(
        {
          ...buildInitialState(),
          ...action.payload,
          phaseStatuses: normalizePhaseStatuses(action.payload.phaseStatuses),
        },
        false,
      );
      const timestamp = action.payload.lastSavedAt ?? seeded.lastSavedAt ?? null;
      return seedPhaseChecksums(seeded, timestamp);
    }
    case 'RESET':
      return buildInitialState();
    case 'SET_OPERATIONAL':
      return recalcBreakdowns({ ...state, operational: normalizeOperationalConfig(action.payload) });
    case 'SET_EQUIPMENT_HIERARCHY':
      return recalcBreakdowns({ ...state, useEquipmentHierarchy: action.payload });
    case 'UPSERT_EQUIPMENT': {
      const exists = state.equipment.some(item => item.id === action.payload.id);
      const nextEquipment = exists
        ? state.equipment.map(item => (item.id === action.payload.id ? action.payload : item))
        : [...state.equipment, action.payload];
      return recalcBreakdowns({ ...state, equipment: nextEquipment });
    }
    case 'REMOVE_EQUIPMENT': {
      const nextEquipment = state.equipment.filter(item => item.id !== action.payload.id);
      return recalcBreakdowns({ ...state, equipment: nextEquipment });
    }
    case 'UPSERT_STAFF': {
      const exists = state.staff.some(item => item.id === action.payload.id);
      const nextStaff = exists
        ? state.staff.map(item => (item.id === action.payload.id ? action.payload : item))
        : [...state.staff, action.payload];
      return recalcBreakdowns({ ...state, staff: nextStaff });
    }
    case 'REMOVE_STAFF': {
      const nextStaff = state.staff.filter(item => item.id !== action.payload.id);
      const nextProcedures = state.procedures.map(procedure => ({
        ...procedure,
        staffAssignments: procedure.staffAssignments.filter(assignment => assignment.staffId !== action.payload.id),
      }));
      return recalcBreakdowns({ ...state, staff: nextStaff, procedures: nextProcedures });
    }
    case 'UPSERT_MATERIAL': {
      const exists = state.materials.some(item => item.id === action.payload.id);
      const nextMaterials = exists
        ? state.materials.map(item => (item.id === action.payload.id ? action.payload : item))
        : [...state.materials, action.payload];
      return recalcBreakdowns({ ...state, materials: nextMaterials });
    }
    case 'REMOVE_MATERIAL': {
      const nextMaterials = state.materials.filter(item => item.id !== action.payload.id);
      const nextProcedures = state.procedures.map(procedure => ({
        ...procedure,
        materialUsages: procedure.materialUsages.filter(usage => usage.materialId !== action.payload.id),
      }));
      return recalcBreakdowns({ ...state, materials: nextMaterials, procedures: nextProcedures });
    }
    case 'UPSERT_FIXED_COST': {
      const payload = normalizeFixedCost(action.payload);
      const exists = state.fixedCosts.some(item => item.id === payload.id);
      const nextFixedCosts = exists
        ? state.fixedCosts.map(item => (item.id === payload.id ? payload : item))
        : [...state.fixedCosts, payload];
      return recalcBreakdowns({ ...state, fixedCosts: nextFixedCosts });
    }
    case 'REMOVE_FIXED_COST': {
      const nextFixedCosts = state.fixedCosts.filter(item => item.id !== action.payload.id);
      return recalcBreakdowns({ ...state, fixedCosts: nextFixedCosts });
    }
    case 'UPSERT_PROCEDURE': {
      const exists = state.procedures.some(item => item.id === action.payload.id);
      const nextProcedures = exists
        ? state.procedures.map(item => (item.id === action.payload.id ? action.payload : item))
        : [...state.procedures, action.payload];
      return recalcBreakdowns({ ...state, procedures: nextProcedures });
    }
    case 'REMOVE_PROCEDURE': {
      const nextProcedures = state.procedures.filter(item => item.id !== action.payload.id);
      return recalcBreakdowns({ ...state, procedures: nextProcedures });
    }
    case 'UPSERT_PROCEDURE_ACTUAL': {
      const procedureId = action.payload.procedureId.trim();
      if (!procedureId) {
        return state;
      }
      const performedValue = Number(action.payload.performed);
      const performed = Number.isFinite(performedValue) && performedValue >= 0 ? performedValue : 0;
      const marketingValue =
        typeof action.payload.marketingSpend === 'number' ? action.payload.marketingSpend : action.payload.marketingSpend ?? null;
      const marketingSpend =
        typeof marketingValue === 'number' && Number.isFinite(marketingValue) && marketingValue >= 0 ? marketingValue : null;
      const normalized: ProcedureActualPerformance = {
        procedureId,
        performed,
        marketingSpend,
        notes: action.payload.notes && action.payload.notes.trim() ? action.payload.notes.trim() : undefined,
      };
      const exists = state.procedureActuals.some(item => item.procedureId === procedureId);
      const nextActuals = exists
        ? state.procedureActuals.map(item => (item.procedureId === procedureId ? normalized : item))
        : [...state.procedureActuals, normalized];
      return {
        ...state,
        procedureActuals: nextActuals,
        lastSavedAt: new Date().toISOString(),
      };
    }
    case 'REMOVE_PROCEDURE_ACTUAL': {
      const nextActuals = state.procedureActuals.filter(item => item.procedureId !== action.payload.procedureId);
      if (nextActuals.length === state.procedureActuals.length) {
        return state;
      }
      return {
        ...state,
        procedureActuals: nextActuals,
        lastSavedAt: new Date().toISOString(),
      };
    }
    case 'SET_MARKETING_SETTINGS': {
      const nextSettings = normalizeMarketingSettings({
        ...state.marketingSettings,
        ...action.payload,
      });
      return {
        ...state,
        marketingSettings: nextSettings,
        lastSavedAt: new Date().toISOString(),
      };
    }
    case 'SET_BREAKDOWNS':
      return recalcBreakdowns(state);
    case 'MARK_PHASES_SAVED': {
      const nextStatuses = { ...state.phaseStatuses };
      Object.entries(action.payload.phases).forEach(([phaseId, status]) => {
        if (status) {
          nextStatuses[phaseId as CostingPhaseId] = {
            lastSavedAt: status.lastSavedAt ?? action.payload.timestamp,
            checksum: status.checksum ?? null,
          };
        }
      });
      return {
        ...state,
        phaseStatuses: nextStatuses,
        lastSavedAt: action.payload.timestamp,
      };
    }
    default:
      return state;
  }
};

interface ProcedureEditorController {
  isOpen: boolean;
  procedureId: string | null;
}

interface PhaseProgress {
  id: CostingPhaseId;
  lastSavedAt: string | null;
  checksum: string | null;
  currentChecksum: string;
  isDirty: boolean;
}

interface StandaloneCostingContextValue {
  state: StandaloneCostingState;
  setOperationalConfig: (payload: OperationalConfig) => void;
  setEquipmentHierarchyEnabled: (enabled: boolean) => void;
  upsertEquipment: (payload: EquipmentProfile) => void;
  removeEquipment: (id: string) => void;
  upsertStaff: (payload: StaffProfile) => void;
  removeStaff: (id: string) => void;
  upsertMaterial: (payload: MaterialItem) => void;
  removeMaterial: (id: string) => void;
  upsertFixedCost: (payload: FixedCostItem) => void;
  removeFixedCost: (id: string) => void;
  upsertProcedure: (payload: ProcedureFormValues) => void;
  removeProcedure: (id: string) => void;
  upsertProcedureActual: (payload: ProcedureActualPerformance) => void;
  removeProcedureActual: (procedureId: string) => void;
  setMarketingSettings: (payload: Partial<MarketingSettings>) => void;
  resetAll: () => void;
  hydrated: boolean;
  openProcedureEditor: (procedureId?: string | null) => void;
  closeProcedureEditor: () => void;
  procedureEditor: ProcedureEditorController;
  phaseProgress: Record<CostingPhaseId, PhaseProgress>;
  savePhase: (phaseId: CostingPhaseId) => Promise<void>;
}

const StandaloneCostingContext = createContext<StandaloneCostingContextValue | null>(null);

export const StandaloneCostingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, undefined, buildInitialState);
  const hydratedRef = useRef(false);
  const migrationNoticeRef = useRef(false);
  const [hydrated, setHydrated] = useState(false);
  const [procedureEditor, setProcedureEditor] = useState<ProcedureEditorController>({ isOpen: false, procedureId: null });
  const stateRef = useRef(state);

  useEffect(() => {
    if (hydratedRef.current) {
      return;
    }

    const restoreState = async () => {
      const restored = await loadDraft();
      if (restored) {
        dispatch({ type: 'LOAD_STATE', payload: restored.state });
        if (restored.migrated) {
          migrationNoticeRef.current = true;
        }
      }
      hydratedRef.current = true;
      setHydrated(true);
    };

    restoreState().catch(error => {
      console.error('[StandaloneCosting] Failed to restore state', error);
      hydratedRef.current = true;
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated || !migrationNoticeRef.current || typeof window === 'undefined') {
      return;
    }
    migrationNoticeRef.current = false;
    const timer = window.setTimeout(() => {
      window.alert('기존 고정비가 시설·운영비 기준으로 불러와졌습니다. 필요하면 공통비용이나 마케팅 비용으로 재분류해 주세요.');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [hydrated]);

  useEffect(() => {
    if (!hydratedRef.current) {
      return;
    }
    const persist = async () => {
      await saveDraft(state);
    };
    persist().catch(error => {
      console.error('[StandaloneCosting] Failed to persist state', error);
    });
  }, [state]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const phaseProgress = useMemo<Record<CostingPhaseId, PhaseProgress>>(() => {
    const entries: Partial<Record<CostingPhaseId, PhaseProgress>> = {};
    COSTING_PHASES.forEach(phase => {
      const stored = state.phaseStatuses[phase] ?? { lastSavedAt: null, checksum: null };
      const currentChecksum = computePhaseChecksum(state, phase);
      entries[phase] = {
        id: phase,
        lastSavedAt: stored.lastSavedAt ?? null,
        checksum: stored.checksum ?? null,
        currentChecksum,
        isDirty: (stored.checksum ?? null) !== currentChecksum,
      };
    });
    return entries as Record<CostingPhaseId, PhaseProgress>;
  }, [state]);

  const setOperationalConfig = useCallback((payload: OperationalConfig) => {
    dispatch({ type: 'SET_OPERATIONAL', payload });
  }, []);

  const upsertStaff = useCallback((payload: StaffProfile) => {
    dispatch({ type: 'UPSERT_STAFF', payload });
  }, []);

  const setEquipmentHierarchyEnabled = useCallback((enabled: boolean) => {
    dispatch({ type: 'SET_EQUIPMENT_HIERARCHY', payload: enabled });
  }, []);

  const upsertEquipment = useCallback((payload: EquipmentProfile) => {
    dispatch({ type: 'UPSERT_EQUIPMENT', payload });
  }, []);

  const removeEquipment = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_EQUIPMENT', payload: { id } });
  }, []);

  const removeStaff = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_STAFF', payload: { id } });
  }, []);

  const upsertMaterial = useCallback((payload: MaterialItem) => {
    dispatch({ type: 'UPSERT_MATERIAL', payload });
  }, []);

  const removeMaterial = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_MATERIAL', payload: { id } });
  }, []);

  const upsertFixedCost = useCallback((payload: FixedCostItem) => {
    dispatch({ type: 'UPSERT_FIXED_COST', payload });
  }, []);

  const removeFixedCost = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_FIXED_COST', payload: { id } });
  }, []);

  const upsertProcedure = useCallback((payload: ProcedureFormValues) => {
    dispatch({ type: 'UPSERT_PROCEDURE', payload });
  }, []);

  const removeProcedure = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_PROCEDURE', payload: { id } });
  }, []);

  const upsertProcedureActual = useCallback((payload: ProcedureActualPerformance) => {
    dispatch({ type: 'UPSERT_PROCEDURE_ACTUAL', payload });
  }, []);

  const removeProcedureActual = useCallback((procedureId: string) => {
    dispatch({ type: 'REMOVE_PROCEDURE_ACTUAL', payload: { procedureId } });
  }, []);

  const setMarketingSettings = useCallback((payload: Partial<MarketingSettings>) => {
    dispatch({ type: 'SET_MARKETING_SETTINGS', payload });
  }, []);

  const resetAll = useCallback(() => {
    const reset = async () => {
      await clearDraft();
    };
    reset().catch(error => {
      console.error('[StandaloneCosting] Failed to reset state', error);
    });
    dispatch({ type: 'RESET' });
  }, []);

  const openProcedureEditor = useCallback((procedureId?: string | null) => {
    setProcedureEditor({ isOpen: true, procedureId: procedureId ?? null });
  }, []);

  const closeProcedureEditor = useCallback(() => {
    setProcedureEditor({ isOpen: false, procedureId: null });
  }, []);

  const savePhase = useCallback(async (phaseId: CostingPhaseId) => {
    const snapshot = stateRef.current;
    const timestamp = new Date().toISOString();
    const related = PHASE_SAVE_PROPAGATION[phaseId] ?? [];
    const targets = new Set<CostingPhaseId>([phaseId, ...related]);
    const phases: Partial<Record<CostingPhaseId, CostingPhaseStatus>> = {};
    targets.forEach(id => {
      phases[id] = {
        lastSavedAt: timestamp,
        checksum: computePhaseChecksum(snapshot, id),
      };
    });
    dispatch({ type: 'MARK_PHASES_SAVED', payload: { phases, timestamp } });
  }, []);

  const value = useMemo<StandaloneCostingContextValue>(() => ({
    state,
    setOperationalConfig,
    setEquipmentHierarchyEnabled,
    upsertEquipment,
    removeEquipment,
    upsertStaff,
    removeStaff,
    upsertMaterial,
    removeMaterial,
    upsertFixedCost,
    removeFixedCost,
    upsertProcedure,
    removeProcedure,
    upsertProcedureActual,
    removeProcedureActual,
    setMarketingSettings,
    resetAll,
    hydrated,
    openProcedureEditor,
    closeProcedureEditor,
    procedureEditor,
    phaseProgress,
    savePhase,
  }), [
    state,
    setOperationalConfig,
    setEquipmentHierarchyEnabled,
    upsertEquipment,
    removeEquipment,
    upsertStaff,
    removeStaff,
    upsertMaterial,
    removeMaterial,
    upsertFixedCost,
    removeFixedCost,
    upsertProcedure,
    removeProcedure,
    upsertProcedureActual,
    removeProcedureActual,
    setMarketingSettings,
    resetAll,
    hydrated,
    openProcedureEditor,
    closeProcedureEditor,
    procedureEditor,
    phaseProgress,
    savePhase,
  ]);

  return (
    <StandaloneCostingContext.Provider value={value}>
      {children}
    </StandaloneCostingContext.Provider>
  );
};

export const useStandaloneCosting = (): StandaloneCostingContextValue => {
  const context = useContext(StandaloneCostingContext);
  if (!context) {
    throw new Error('StandaloneCostingContext is not available');
  }
  return context;
};
