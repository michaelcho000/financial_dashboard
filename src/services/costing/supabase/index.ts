import { CostingServicesBundle } from '../factory';
import {
  CostingCalculationService,
  CostingBaselineService,
  FixedCostLinkService,
  StaffDataService,
  ConsumableDataService,
  ProcedureDataService,
} from '../types';

const notImplementedAsync = async (method: string): Promise<never> => {
  throw new Error(`[Costing] Supabase backend stub for "${method}" is not implemented yet.`);
};

const baselineService: CostingBaselineService = {
  async listBaselines() {
    return notImplementedAsync('listBaselines');
  },
  async getBaseline(id) {
    return notImplementedAsync(`getBaseline(${id})`);
  },
  async createBaseline(payload) {
    return notImplementedAsync('createBaseline');
  },
  async updateBaseline(id, payload) {
    return notImplementedAsync(`updateBaseline(${id})`);
  },
  async lockBaseline(id) {
    return notImplementedAsync(`lockBaseline(${id})`);
  },
  async unlockBaseline(id) {
    return notImplementedAsync(`unlockBaseline(${id})`);
  },
};

const fixedCostLinkService: FixedCostLinkService = {
  async getSelection(baselineId) {
    return notImplementedAsync(`getSelection(${baselineId})`);
  },
  async updateSelection(baselineId, payload) {
    return notImplementedAsync(`updateSelection(${baselineId})`);
  },
};

const staffDataService: StaffDataService = {
  async getStaff(baselineId) {
    return notImplementedAsync(`getStaff(${baselineId})`);
  },
  async upsertStaff(baselineId, input) {
    return notImplementedAsync(`upsertStaff(${baselineId})`);
  },
};

const consumableDataService: ConsumableDataService = {
  async getConsumables(baselineId) {
    return notImplementedAsync(`getConsumables(${baselineId})`);
  },
  async upsertConsumables(baselineId, input) {
    return notImplementedAsync(`upsertConsumables(${baselineId})`);
  },
};

const procedureDataService: ProcedureDataService = {
  async listProcedures(baselineId) {
    return notImplementedAsync(`listProcedures(${baselineId})`);
  },
  async createProcedure(baselineId, input) {
    return notImplementedAsync(`createProcedure(${baselineId})`);
  },
  async updateProcedureVariant(baselineId, variantId, input) {
    return notImplementedAsync(`updateProcedureVariant(${baselineId}, ${variantId})`);
  },
  async deleteProcedureVariant(baselineId, variantId) {
    return notImplementedAsync(`deleteProcedureVariant(${baselineId}, ${variantId})`);
  },
};

const calculationService: CostingCalculationService = {
  async recalculate(baselineId) {
    return notImplementedAsync(`recalculate(${baselineId})`);
  },
  async getResults(baselineId, params) {
    return notImplementedAsync(`getResults(${baselineId})`);
  },
  async getInsights(baselineId) {
    return notImplementedAsync(`getInsights(${baselineId})`);
  },
  async exportResults(baselineId, format) {
    return notImplementedAsync(`exportResults(${baselineId}, ${format})`);
  },
};

export const createSupabaseCostingServices = (): CostingServicesBundle => ({
  baselineService,
  fixedCostLinkService,
  staffDataService,
  consumableDataService,
  procedureDataService,
  calculationService,
});
