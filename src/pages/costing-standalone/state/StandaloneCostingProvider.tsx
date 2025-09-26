import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { buildAllBreakdowns } from '../../../services/standaloneCosting/calculations';
import { clearDraft, loadDraft, saveDraft } from '../../../services/standaloneCosting/storage';
import { FixedCostItem, MaterialItem, OperationalConfig, ProcedureFormValues, StandaloneCostingState, StaffProfile } from '../../../services/standaloneCosting/types';

type StandaloneCostingAction =
  | { type: 'LOAD_STATE'; payload: StandaloneCostingState }
  | { type: 'RESET' }
  | { type: 'SET_OPERATIONAL'; payload: OperationalConfig }
  | { type: 'UPSERT_STAFF'; payload: StaffProfile }
  | { type: 'REMOVE_STAFF'; payload: { id: string } }
  | { type: 'UPSERT_MATERIAL'; payload: MaterialItem }
  | { type: 'REMOVE_MATERIAL'; payload: { id: string } }
  | { type: 'UPSERT_FIXED_COST'; payload: FixedCostItem }
  | { type: 'REMOVE_FIXED_COST'; payload: { id: string } }
  | { type: 'UPSERT_PROCEDURE'; payload: ProcedureFormValues }
  | { type: 'REMOVE_PROCEDURE'; payload: { id: string } }
  | { type: 'SET_BREAKDOWNS' };

const buildInitialState = (): StandaloneCostingState => ({
  operational: { operatingDays: null, operatingHoursPerDay: null, notes: undefined },
  staff: [],
  materials: [],
  fixedCosts: [],
  procedures: [],
  breakdowns: [],
  lastSavedAt: null,
});

const recalcBreakdowns = (state: StandaloneCostingState, touchTimestamp = true): StandaloneCostingState => {
  const breakdowns = buildAllBreakdowns(state.procedures, {
    staff: state.staff,
    materials: state.materials,
    fixedCosts: state.fixedCosts,
    operational: state.operational,
  });

  return {
    ...state,
    breakdowns,
    lastSavedAt: touchTimestamp ? new Date().toISOString() : state.lastSavedAt,
  };
};

const reducer = (state: StandaloneCostingState, action: StandaloneCostingAction): StandaloneCostingState => {
  switch (action.type) {
    case 'LOAD_STATE':
      return recalcBreakdowns({ ...action.payload }, false);
    case 'RESET':
      return buildInitialState();
    case 'SET_OPERATIONAL':
      return recalcBreakdowns({ ...state, operational: action.payload });
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
      const exists = state.fixedCosts.some(item => item.id === action.payload.id);
      const nextFixedCosts = exists
        ? state.fixedCosts.map(item => (item.id === action.payload.id ? action.payload : item))
        : [...state.fixedCosts, action.payload];
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

interface StandaloneCostingContextValue {
  state: StandaloneCostingState;
  setOperationalConfig: (payload: OperationalConfig) => void;
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
}

const StandaloneCostingContext = createContext<StandaloneCostingContextValue | null>(null);

export const StandaloneCostingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, undefined, buildInitialState);
  const hydratedRef = useRef(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydratedRef.current) {
      return;
    }
    const restored = loadDraft();
    if (restored) {
      dispatch({ type: 'LOAD_STATE', payload: restored });
    }
    hydratedRef.current = true;
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) {
      return;
    }
    saveDraft(state);
  }, [state]);

  const setOperationalConfig = useCallback((payload: OperationalConfig) => {
    dispatch({ type: 'SET_OPERATIONAL', payload });
  }, []);

  const upsertStaff = useCallback((payload: StaffProfile) => {
    dispatch({ type: 'UPSERT_STAFF', payload });
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
    clearDraft();
    dispatch({ type: 'RESET' });
  }, []);

  const value = useMemo<StandaloneCostingContextValue>(() => ({
    state,
    setOperationalConfig,
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
  }), [state, setOperationalConfig, upsertStaff, removeStaff, upsertMaterial, removeMaterial, upsertFixedCost, removeFixedCost, upsertProcedure, removeProcedure, resetAll, hydrated]);

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
