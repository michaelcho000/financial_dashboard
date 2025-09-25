import {
  CostingCalculationService,
  CostingBaselineService,
  FixedCostLinkService,
  StaffDataService,
  ConsumableDataService,
  ProcedureDataService,
} from './types';
import { featureFlags } from '../../config/featureFlags';
import { createLocalCostingServices } from './local';
import { createSupabaseCostingServices } from './supabase';

type CostingBackend = 'local' | 'supabase';

const resolveBackend = (): CostingBackend => {
  if (!featureFlags.costingModule) {
    return 'local';
  }
  if (typeof import.meta !== 'undefined' && (import.meta as ImportMeta)?.env?.VITE_COSTING_BACKEND) {
    const value = (import.meta as ImportMeta).env.VITE_COSTING_BACKEND?.toLowerCase();
    if (value === 'supabase') {
      return 'supabase';
    }
  }
  return 'local';
};

export interface CostingServicesBundle {
  baselineService: CostingBaselineService;
  fixedCostLinkService: FixedCostLinkService;
  staffDataService: StaffDataService;
  consumableDataService: ConsumableDataService;
  procedureDataService: ProcedureDataService;
  calculationService: CostingCalculationService;
}

export const createCostingServices = (): CostingServicesBundle => {
  const backend = resolveBackend();
  if (backend === 'supabase') {
    return createSupabaseCostingServices();
  }
  return createLocalCostingServices();
};
