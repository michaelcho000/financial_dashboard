import {
  ConsumableDataService,
  ConsumablePricingInput,
  CostingCalculationService,
  CostingResultRow,
  CostingSnapshotService,
  CostBreakdown,
  FixedCostLinkService,
  InsightPayload,
  ProcedureDataService,
  ProcedureDefinitionInput,
  ProcedureSummary,
  ProcedureVariantInput,
  ProcedureVariantSummary,
  RecalculateResponse,
  SnapshotCreatePayload,
  SnapshotDetail,
  SnapshotSummary,
  SnapshotUpdatePayload,
  StaffCapacityInput,
  StaffDataService,
} from '../types';
import { CostingServicesBundle } from '../factory';
import {
  localDB,
  StoredProcedureDefinition,
  StoredProcedureVariant,
  StoredSnapshot,
} from './storage';

const buildSnapshotSummary = (snapshot: StoredSnapshot): SnapshotSummary => ({
  id: snapshot.id,
  month: snapshot.month,
  status: snapshot.status,
  includeFixedCosts: snapshot.includeFixedCosts,
  lockedAt: snapshot.lockedAt,
  lastCalculatedAt: snapshot.lastCalculatedAt,
  createdAt: snapshot.createdAt,
});

const buildSnapshotDetail = (snapshot: StoredSnapshot): SnapshotDetail => ({
  ...buildSnapshotSummary(snapshot),
  appliedFixedCostIds: [...snapshot.appliedFixedCostIds],
});

const ensureSnapshotExists = (snapshotId: string): StoredSnapshot => {
  const db = localDB.load();
  const snapshot = db.snapshots[snapshotId];
  if (!snapshot) {
    throw new Error(`Snapshot(${snapshotId}) not found.`);
  }
  return snapshot;
};

const listProceduresInternal = (snapshotId: string): StoredProcedureDefinition[] => {
  const db = localDB.load();
  return localDB.clone(db.procedures[snapshotId] ?? []);
};

const buildProcedureSummary = (definition: StoredProcedureDefinition): ProcedureSummary => ({
  procedureId: definition.id,
  name: definition.name,
  variants: definition.variants.map(buildVariantSummary),
});

const buildVariantSummary = (variant: StoredProcedureVariant): ProcedureVariantSummary => ({
  variantId: variant.id,
  label: variant.label,
  salePrice: variant.salePrice,
  totalMinutes: variant.totalMinutes,
  staffMix: localDB.clone(variant.staffMix),
  consumables: localDB.clone(variant.consumables),
  equipmentLinks: localDB.clone(variant.equipmentLinks),
});

const getStaffMap = (staff: StaffCapacityInput[]): Map<string, StaffCapacityInput> => {
  const map = new Map<string, StaffCapacityInput>();
  staff.forEach(entry => {
    if (entry.roleId) {
      map.set(entry.roleId, entry);
    }
    map.set(entry.roleName.toLowerCase(), entry);
  });
  return map;
};

const getConsumableMap = (consumables: ConsumablePricingInput[]): Map<string, ConsumablePricingInput> => {
  const map = new Map<string, ConsumablePricingInput>();
  consumables.forEach(entry => {
    if (entry.consumableId) {
      map.set(entry.consumableId, entry);
    }
    map.set(entry.consumableName.toLowerCase(), entry);
  });
  return map;
};

const calculateCostBreakdown = (
  variant: StoredProcedureVariant,
  staffMap: Map<string, StaffCapacityInput>,
  consumableMap: Map<string, ConsumablePricingInput>
): CostBreakdown => {
  const labor = variant.staffMix.reduce((acc, mix) => {
    const matched = mix.roleId ? staffMap.get(mix.roleId) : undefined;
    const fallback = staffMap.get(mix.roleName.toLowerCase());
    const entry = matched ?? fallback;
    if (!entry || !entry.availableMinutes) {
      return acc;
    }
    const costPerMinute = entry.monthlyPayroll / entry.availableMinutes;
    return acc + costPerMinute * mix.minutes * Math.max(mix.participants, 1);
  }, 0);

  const consumables = variant.consumables.reduce((acc, usage) => {
    const matched = usage.consumableId ? consumableMap.get(usage.consumableId) : undefined;
    const fallback = consumableMap.get(usage.consumableName.toLowerCase());
    const entry = matched ?? fallback;
    if (!entry || !entry.yieldQuantity) {
      return acc;
    }
    const unitCost = entry.purchaseCost / entry.yieldQuantity;
    return acc + unitCost * usage.quantity;
  }, 0);

  return {
    labor,
    consumables,
    facilityFixed: 0,
    equipmentFixed: 0,
  };
};

const calculateResults = (
  snapshotId: string,
  snapshot: StoredSnapshot,
  staff: StaffCapacityInput[],
  consumables: ConsumablePricingInput[],
  procedures: StoredProcedureDefinition[]
): { rows: CostingResultRow[]; insights: InsightPayload } => {
  const staffMap = getStaffMap(staff);
  const consumableMap = getConsumableMap(consumables);

  const rows: CostingResultRow[] = [];

  procedures.forEach(definition => {
    definition.variants.forEach(variant => {
      const costBreakdown = calculateCostBreakdown(variant, staffMap, consumableMap);
      const directCost =
        costBreakdown.labor + costBreakdown.consumables + costBreakdown.facilityFixed + costBreakdown.equipmentFixed;
      const margin = variant.salePrice - directCost;
      const marginRate = variant.salePrice > 0 ? margin / variant.salePrice : 0;
      const marginPerMinute = variant.totalMinutes > 0 ? margin / variant.totalMinutes : null;
      const caseCount = (variant as unknown as { caseCount?: number }).caseCount ?? 0;

      rows.push({
        procedureName: definition.name,
        variantName: variant.label,
        caseCount,
        salePrice: variant.salePrice,
        totalCost: directCost,
        margin,
        marginRate,
        marginPerMinute,
        costBreakdown,
      });
    });
  });

  const insights: InsightPayload = {};

  if (rows.length > 0) {
    const topByVolume = rows.reduce<(CostingResultRow & { index: number }) | null>((acc, row, index) => {
      if (!acc || row.caseCount > acc.caseCount) {
        return { ...row, index };
      }
      return acc;
    }, null);
    if (topByVolume && topByVolume.caseCount > 0) {
      insights.topByVolume = {
        procedureId: String(topByVolume.index),
        cases: topByVolume.caseCount,
      };
    }

    const topByMargin = rows.reduce<(CostingResultRow & { index: number }) | null>((acc, row, index) => {
      if (!acc || row.margin > acc.margin) {
        return { ...row, index };
      }
      return acc;
    }, null);
    if (topByMargin && topByMargin.margin > 0) {
      insights.topByMargin = {
        procedureId: String(topByMargin.index),
        margin: topByMargin.margin,
      };
    }

    const lowestMarginRate = rows.reduce<(CostingResultRow & { index: number }) | null>((acc, row, index) => {
      if (!acc || row.marginRate < acc.marginRate) {
        return { ...row, index };
      }
      return acc;
    }, null);
    if (lowestMarginRate) {
      insights.lowestMarginRate = {
        procedureId: String(lowestMarginRate.index),
        marginRate: lowestMarginRate.marginRate,
      };
    }
  }

  return { rows, insights };
};

const snapshotService: CostingSnapshotService = {
  async listSnapshots() {
    const db = localDB.load();
    return Object.values(db.snapshots)
      .map(buildSnapshotSummary)
      .sort((a, b) => b.month.localeCompare(a.month));
  },
  async getSnapshot(id: string): Promise<SnapshotDetail> {
    const snapshot = ensureSnapshotExists(id);
    return buildSnapshotDetail(snapshot);
  },
  async createSnapshot(payload: SnapshotCreatePayload) {
    return localDB.mutate(db => {
      if (Object.values(db.snapshots).some(s => s.month === payload.month)) {
        throw new Error(`Snapshot for month ${payload.month} already exists.`);
      }

      const id = localDB.generateId();
      const timestamp = localDB.now();
      const snapshot: StoredSnapshot = {
        id,
        tenantId: null,
        month: payload.month,
        status: 'DRAFT',
        includeFixedCosts: payload.includeFixedCosts,
        appliedFixedCostIds: [],
        lockedAt: null,
        lockedBy: null,
        lastCalculatedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      db.snapshots[id] = snapshot;
      db.staff[id] = [];
      db.consumables[id] = [];
      db.procedures[id] = [];
      db.fixedCostSelections[id] = {
        includeFixedCosts: payload.includeFixedCosts,
        items: [],
      };

      if (payload.sourceSnapshotId && db.snapshots[payload.sourceSnapshotId]) {
        const sourceId = payload.sourceSnapshotId;
        db.staff[id] = localDB.clone(db.staff[sourceId] ?? []);
        db.consumables[id] = localDB.clone(db.consumables[sourceId] ?? []);
        db.procedures[id] = localDB.clone(db.procedures[sourceId] ?? []);
        const sourceSelection = db.fixedCostSelections[sourceId];
        if (sourceSelection) {
          db.fixedCostSelections[id] = {
            includeFixedCosts: payload.includeFixedCosts,
            items: localDB.clone(sourceSelection.items),
          };
          snapshot.appliedFixedCostIds = sourceSelection.items
            .filter(item => item.included)
            .map(item => item.templateId);
        }
      }

      return buildSnapshotDetail(snapshot);
    });
  },
  async updateSnapshot(id: string, payload: SnapshotUpdatePayload) {
    return localDB.mutate(db => {
      const snapshot = db.snapshots[id];
      if (!snapshot) {
        throw new Error(`Snapshot(${id}) not found.`);
      }
      if (payload.status) {
        snapshot.status = payload.status;
        if (payload.status !== 'LOCKED') {
          snapshot.lockedAt = null;
          snapshot.lockedBy = null;
        }
      }
      if (typeof payload.includeFixedCosts === 'boolean') {
        snapshot.includeFixedCosts = payload.includeFixedCosts;
      }
      snapshot.updatedAt = localDB.now();
      return buildSnapshotDetail(snapshot);
    });
  },
  async lockSnapshot(id: string) {
    localDB.mutate(db => {
      const snapshot = db.snapshots[id];
      if (!snapshot) {
        throw new Error(`Snapshot(${id}) not found.`);
      }
      snapshot.status = 'LOCKED';
      snapshot.lockedAt = localDB.now();
      snapshot.lockedBy = null;
      snapshot.updatedAt = snapshot.lockedAt;
    });
  },
  async unlockSnapshot(id: string) {
    localDB.mutate(db => {
      const snapshot = db.snapshots[id];
      if (!snapshot) {
        throw new Error(`Snapshot(${id}) not found.`);
      }
      snapshot.status = 'DRAFT';
      snapshot.lockedAt = null;
      snapshot.lockedBy = null;
      snapshot.updatedAt = localDB.now();
    });
  },
};

const fixedCostLinkService: FixedCostLinkService = {
  async getSelection(snapshotId) {
    ensureSnapshotExists(snapshotId);
    const db = localDB.load();
    const existing = db.fixedCostSelections[snapshotId];
    if (existing) {
      return localDB.clone(existing);
    }
    return {
      includeFixedCosts: true,
      items: [],
    };
  },
  async updateSelection(snapshotId, payload) {
    localDB.mutate(db => {
      const snapshot = db.snapshots[snapshotId];
      if (!snapshot) {
        throw new Error(`Snapshot(${snapshotId}) not found.`);
      }
      db.fixedCostSelections[snapshotId] = {
        includeFixedCosts: payload.includeFixedCosts,
        items: payload.items.map(item => ({ ...item })),
      };
      snapshot.includeFixedCosts = payload.includeFixedCosts;
      snapshot.appliedFixedCostIds = payload.items.filter(item => item.included).map(item => item.templateId);
      snapshot.updatedAt = localDB.now();
    });
  },
};

const staffDataService: StaffDataService = {
  async getStaff(snapshotId) {
    ensureSnapshotExists(snapshotId);
    const db = localDB.load();
    return localDB.clone(db.staff[snapshotId] ?? []);
  },
  async upsertStaff(snapshotId, input) {
    ensureSnapshotExists(snapshotId);
    localDB.mutate(db => {
      db.staff[snapshotId] = input.map(entry => ({ ...entry }));
    });
  },
};

const consumableDataService: ConsumableDataService = {
  async getConsumables(snapshotId) {
    ensureSnapshotExists(snapshotId);
    const db = localDB.load();
    return localDB.clone(db.consumables[snapshotId] ?? []);
  },
  async upsertConsumables(snapshotId, input) {
    ensureSnapshotExists(snapshotId);
    localDB.mutate(db => {
      db.consumables[snapshotId] = input.map(entry => ({ ...entry }));
    });
  },
};

const procedureDataService: ProcedureDataService = {
  async listProcedures(snapshotId) {
    ensureSnapshotExists(snapshotId);
    const definitions = listProceduresInternal(snapshotId);
    return definitions.map(buildProcedureSummary);
  },
  async createProcedure(snapshotId: string, input: ProcedureDefinitionInput) {
    ensureSnapshotExists(snapshotId);
    return localDB.mutate(db => {
      const definitions = db.procedures[snapshotId] ?? [];
      const newId = input.procedureId ?? localDB.generateId();
      if (definitions.some(def => def.id === newId)) {
        throw new Error(`Procedure(${newId}) already exists.`);
      }
      const stored: StoredProcedureDefinition = {
        id: newId,
        name: input.name,
        variants: input.variants.map(variant => ({
          id: variant.variantId ?? localDB.generateId(),
          label: variant.label,
          salePrice: variant.salePrice,
          totalMinutes: variant.totalMinutes,
          equipmentMinutes: variant.equipmentMinutes ?? null,
          fixedCostTemplateId: variant.fixedCostTemplateId ?? null,
          staffMix: variant.staffMix.map(entry => ({ ...entry })),
          consumables: variant.consumables.map(entry => ({ ...entry })),
          equipmentLinks: variant.equipmentLinks.map(entry => ({ ...entry })),
        })),
      };
      db.procedures[snapshotId] = [...definitions, stored];
      return buildProcedureSummary(stored);
    });
  },
  async updateProcedureVariant(snapshotId: string, variantId: string, input: ProcedureVariantInput) {
    ensureSnapshotExists(snapshotId);
    return localDB.mutate(db => {
      const definitions = db.procedures[snapshotId] ?? [];
      const definition = definitions.find(def => def.variants.some(v => v.id === variantId));
      if (!definition) {
        throw new Error(`Variant(${variantId}) not found.`);
      }
      const variant = definition.variants.find(v => v.id === variantId)!;
      variant.label = input.label;
      variant.salePrice = input.salePrice;
      variant.totalMinutes = input.totalMinutes;
      variant.equipmentMinutes = input.equipmentMinutes ?? null;
      variant.fixedCostTemplateId = input.fixedCostTemplateId ?? null;
      variant.staffMix = input.staffMix.map(entry => ({ ...entry }));
      variant.consumables = input.consumables.map(entry => ({ ...entry }));
      variant.equipmentLinks = input.equipmentLinks.map(entry => ({ ...entry }));
      return buildProcedureSummary(definition);
    });
  },
  async deleteProcedureVariant(snapshotId: string, variantId: string) {
    ensureSnapshotExists(snapshotId);
    localDB.mutate(db => {
      const definitions = db.procedures[snapshotId] ?? [];
      const definitionIndex = definitions.findIndex(def => def.variants.some(v => v.id === variantId));
      if (definitionIndex === -1) {
        throw new Error(`Variant(${variantId}) not found.`);
      }
      const definition = definitions[definitionIndex];
      const targetVariant = definition.variants.find(v => v.id === variantId);
      const procedureName = definition.name;
      const variantLabel = targetVariant?.label ?? '';
      definition.variants = definition.variants.filter(v => v.id !== variantId);
      if (definition.variants.length === 0) {
        definitions.splice(definitionIndex, 1);
      }
      db.procedures[snapshotId] = definitions;
      const existingResults = db.results[snapshotId];
      if (existingResults) {
        existingResults.rows = existingResults.rows.filter(
          row => !(row.procedureName === procedureName && row.variantName === variantLabel)
        );
      }
    });
  },
};

const calculationService: CostingCalculationService = {
  async recalculate(snapshotId: string): Promise<RecalculateResponse> {
    const snapshot = ensureSnapshotExists(snapshotId);
    const db = localDB.load();
    const staff = db.staff[snapshotId] ?? [];
    const consumables = db.consumables[snapshotId] ?? [];
    const procedures = db.procedures[snapshotId] ?? [];

    const { rows, insights } = calculateResults(snapshotId, snapshot, staff, consumables, procedures);
    const queuedAt = localDB.now();
    const completedAt = queuedAt;

    localDB.mutate(mutDB => {
      mutDB.results[snapshotId] = {
        rows: rows.map(row => ({ ...row, costBreakdown: { ...row.costBreakdown } })),
        insights: { ...insights },
        lastCalculatedAt: completedAt,
      };
      const targetSnapshot = mutDB.snapshots[snapshotId];
      if (targetSnapshot) {
        targetSnapshot.lastCalculatedAt = completedAt;
        if (targetSnapshot.status === 'DRAFT') {
          targetSnapshot.status = 'READY';
        }
        targetSnapshot.updatedAt = completedAt;
      }
      const jobId = localDB.generateId();
      mutDB.jobs[jobId] = {
        jobId,
        snapshotId,
        status: 'COMPLETED',
        queuedAt,
        completedAt,
      };
    });

    return {
      status: 'COMPLETED',
      queuedAt,
      completedAt,
    };
  },
  async getResults(snapshotId, params) {
    ensureSnapshotExists(snapshotId);
    const db = localDB.load();
    const stored = db.results[snapshotId];
    if (!stored) {
      return [];
    }
    let rows = localDB.clone(stored.rows);
    if (params?.search) {
      const keyword = params.search.toLowerCase();
      rows = rows.filter(row =>
        row.procedureName.toLowerCase().includes(keyword) ||
        row.variantName.toLowerCase().includes(keyword)
      );
    }
    if (params?.sort) {
      const direction = params.order === 'desc' ? -1 : 1;
      rows = [...rows].sort((a, b) => {
        const field = params.sort as keyof CostingResultRow;
        if (typeof a[field] === 'number' && typeof b[field] === 'number') {
          return ((a[field] as number) - (b[field] as number)) * direction;
        }
        return 0;
      });
    }
    return rows;
  },
  async getInsights(snapshotId) {
    ensureSnapshotExists(snapshotId);
    const db = localDB.load();
    const stored = db.results[snapshotId];
    if (!stored) {
      return {};
    }
    return localDB.clone(stored.insights);
  },
  async exportResults(snapshotId, format) {
    ensureSnapshotExists(snapshotId);
    const rows = await calculationService.getResults(snapshotId);
    const header = ['Procedure', 'Variant', 'Cases', 'Sale Price', 'Total Cost', 'Margin', 'Margin Rate'];
    const body = rows
      .map(row => [
        row.procedureName,
        row.variantName,
        String(row.caseCount),
        String(row.salePrice),
        String(row.totalCost),
        String(row.margin),
        row.marginRate.toFixed(4),
      ].join(','))
      .join('\n');
    const csv = `${header.join(',')}\n${body}`;
    if (format === 'csv') {
      return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    }
    return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  },
};

export const createLocalCostingServices = (): CostingServicesBundle => ({
  snapshotService,
  fixedCostLinkService,
  staffDataService,
  consumableDataService,
  procedureDataService,
  calculationService,
});
