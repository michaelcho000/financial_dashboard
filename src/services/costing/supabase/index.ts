import { CostingServicesBundle } from '../factory';
import {
  CostingCalculationService,
  CostingSnapshotService,
  FixedCostLinkService,
  StaffDataService,
  ConsumableDataService,
  ProcedureDataService,
} from '../types';

const notImplementedAsync = async (method: string): Promise<never> => {
  throw new Error(`[Costing] Supabase backend stub for "${method}" is not implemented yet.`);
};

const snapshotService: CostingSnapshotService = {
  async listSnapshots() {
    return notImplementedAsync('listSnapshots');
  },
  async getSnapshot(id) {
    return notImplementedAsync(`getSnapshot(${id})`);
  },
  async createSnapshot(payload) {
    return notImplementedAsync('createSnapshot');
  },
  async updateSnapshot(id, payload) {
    return notImplementedAsync(`updateSnapshot(${id})`);
  },
  async lockSnapshot(id) {
    return notImplementedAsync(`lockSnapshot(${id})`);
  },
  async unlockSnapshot(id) {
    return notImplementedAsync(`unlockSnapshot(${id})`);
  },
};

const fixedCostLinkService: FixedCostLinkService = {
  async getSelection(snapshotId) {
    return notImplementedAsync(`getSelection(${snapshotId})`);
  },
  async updateSelection(snapshotId, payload) {
    return notImplementedAsync(`updateSelection(${snapshotId})`);
  },
};

const staffDataService: StaffDataService = {\n  async getStaff(snapshotId) {\n    return notImplementedAsync(getStaff());\n  },\n  async upsertStaff(snapshotId, input) {
    return notImplementedAsync(`upsertStaff(${snapshotId})`);
  },
};

const consumableDataService: ConsumableDataService = {\n  async getConsumables(snapshotId) {\n    return notImplementedAsync(getConsumables());\n  },\n  async upsertConsumables(snapshotId, input) {
    return notImplementedAsync(`upsertConsumables(${snapshotId})`);
  },
};

const procedureDataService: ProcedureDataService = {
  async listProcedures(snapshotId) {
    return notImplementedAsync(`listProcedures(${snapshotId})`);
  },
  async createProcedure(snapshotId, input) {
    return notImplementedAsync(`createProcedure(${snapshotId})`);
  },
  async updateProcedureVariant(snapshotId, variantId, input) {
    return notImplementedAsync(`updateProcedureVariant(${snapshotId}, ${variantId})`);
  },
  async deleteProcedureVariant(snapshotId, variantId) {
    return notImplementedAsync(`deleteProcedureVariant(${snapshotId}, ${variantId})`);
  },
};

const calculationService: CostingCalculationService = {
  async recalculate(snapshotId) {
    return notImplementedAsync(`recalculate(${snapshotId})`);
  },
  async getResults(snapshotId, params) {
    return notImplementedAsync(`getResults(${snapshotId})`);
  },
  async getInsights(snapshotId) {
    return notImplementedAsync(`getInsights(${snapshotId})`);
  },
  async exportResults(snapshotId, format) {
    return notImplementedAsync(`exportResults(${snapshotId}, ${format})`);
  },
};

export const createSupabaseCostingServices = (): CostingServicesBundle => ({
  snapshotService,
  fixedCostLinkService,
  staffDataService,
  consumableDataService,
  procedureDataService,
  calculationService,
});

