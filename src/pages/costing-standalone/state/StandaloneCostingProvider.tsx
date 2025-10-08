import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { buildAllBreakdowns } from '../../../services/standaloneCosting/calculations';
import { clearDraft, loadDraft, saveDraft } from '../../../services/standaloneCosting/storage';
import {
  EquipmentProfile,
  FixedCostGroup,
  FixedCostItem,
  MaterialItem,
  OperationalConfig,
  OperationalScheduleMode,
  ProcedureFormValues,
  StandaloneCostingState,
  StaffProfile,
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
  | { type: 'SET_BREAKDOWNS' };

const DEFAULT_WEEKS_PER_MONTH = 4.345;
const DAY_SEQUENCE: WeeklyScheduleEntry['day'][] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const TIME_PATTERN = /^([0-1]?\d|2[0-3]):([0-5]\d)$/;
const CALENDAR_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

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

const buildInitialState = (): StandaloneCostingState => ({
  operational: normalizeOperationalConfig(undefined),
  equipment: [],
  useEquipmentHierarchy: false,
  staff: [],
  materials: [],
  fixedCosts: [],
  procedures: [],
  breakdowns: [],
  lastSavedAt: null,
});

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
  const normalizedFixedCosts = normalizeFixedCosts(state.fixedCosts);
  const normalizedOperational = normalizeOperationalConfig(state.operational);
  const breakdowns = buildAllBreakdowns(state.procedures, {
    staff: state.staff,
    materials: state.materials,
    fixedCosts: normalizedFixedCosts,
    operational: normalizedOperational,
  });

  return {
    ...state,
    fixedCosts: normalizedFixedCosts,
    operational: normalizedOperational,
    breakdowns,
    lastSavedAt: touchTimestamp ? new Date().toISOString() : state.lastSavedAt,
  };
};

const reducer = (state: StandaloneCostingState, action: StandaloneCostingAction): StandaloneCostingState => {
  switch (action.type) {
    case 'LOAD_STATE':
      return recalcBreakdowns({ ...buildInitialState(), ...action.payload }, false);
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
    case 'SET_BREAKDOWNS':
      return recalcBreakdowns(state);
    default:
      return state;
  }
};

interface ProcedureEditorController {
  isOpen: boolean;
  procedureId: string | null;
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
  resetAll: () => void;
  hydrated: boolean;
  openProcedureEditor: (procedureId?: string | null) => void;
  closeProcedureEditor: () => void;
  procedureEditor: ProcedureEditorController;
}

const StandaloneCostingContext = createContext<StandaloneCostingContextValue | null>(null);

export const StandaloneCostingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, undefined, buildInitialState);
  const hydratedRef = useRef(false);
  const migrationNoticeRef = useRef(false);
  const [hydrated, setHydrated] = useState(false);
  const [procedureEditor, setProcedureEditor] = useState<ProcedureEditorController>({ isOpen: false, procedureId: null });

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
    resetAll,
    hydrated,
    openProcedureEditor,
    closeProcedureEditor,
    procedureEditor,
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
    resetAll,
    hydrated,
    openProcedureEditor,
    closeProcedureEditor,
    procedureEditor,
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
