import {
  ConsumableDataService,
  ConsumablePricingInput,
  CostingCalculationService,
  CostingResultRow,
  CostingBaselineService,
  CostBreakdown,
  FixedCostLinkService,
  InsightPayload,
  ProcedureDataService,
  ProcedureDefinitionInput,
  ProcedureSummary,
  ProcedureVariantInput,
  ProcedureVariantSummary,
  RecalculateResponse,
  BaselineCreatePayload,
  BaselineDetail,
  BaselineSummary,
  BaselineUpdatePayload,
  StaffCapacityInput,
  StaffDataService,
} from '../types';
import { CostingServicesBundle } from '../factory';
import {
  localDB,
  StoredProcedureDefinition,
  StoredProcedureVariant,
  StoredBaseline,
} from './storage';

const buildBaselineSummary = (baseline: StoredBaseline): BaselineSummary => ({
  id: baseline.id,
  month: baseline.month,
  status: baseline.status,
  includeFixedCosts: baseline.includeFixedCosts,
  lockedAt: baseline.lockedAt,
  lastCalculatedAt: baseline.lastCalculatedAt,
  createdAt: baseline.createdAt,
});

const buildBaselineDetail = (baseline: StoredBaseline): BaselineDetail => ({
  ...buildBaselineSummary(baseline),
  appliedFixedCostIds: [...baseline.appliedFixedCostIds],
});

const ensureBaselineExists = (baselineId: string): StoredBaseline => {
  const db = localDB.load();
  const baseline = db.baselines[baselineId];
  if (!baseline) {
    throw new Error(`Baseline(${baselineId}) not found.`);
  }
  return baseline;
};

const listProceduresInternal = (baselineId: string): StoredProcedureDefinition[] => {
  const db = localDB.load();
  return localDB.clone(db.procedures[baselineId] ?? []);
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
  baselineId: string,
  baseline: StoredBaseline,
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

const baselineService: CostingBaselineService = {
  async listBaselines() {
    const db = localDB.load();
    return Object.values(db.baselines)
      .map(buildBaselineSummary)
      .sort((a, b) => b.month.localeCompare(a.month));
  },
  async getBaseline(id: string): Promise<BaselineDetail> {
    const baseline = ensureBaselineExists(id);
    return buildBaselineDetail(baseline);
  },
  async createBaseline(payload: BaselineCreatePayload) {
    return localDB.mutate(db => {
      if (Object.values(db.baselines).some(s => s.month === payload.month)) {
        throw new Error(`Baseline for month ${payload.month} already exists.`);
      }

      const id = localDB.generateId();
      const timestamp = localDB.now();
      const baseline: StoredBaseline = {
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

      db.baselines[id] = baseline;
      db.staff[id] = [];
      db.consumables[id] = [];
      db.procedures[id] = [];
      db.fixedCostSelections[id] = {
        includeFixedCosts: payload.includeFixedCosts,
        items: [],
      };

      if (payload.sourceBaselineId && db.baselines[payload.sourceBaselineId]) {
        const sourceId = payload.sourceBaselineId;
        db.staff[id] = localDB.clone(db.staff[sourceId] ?? []);
        db.consumables[id] = localDB.clone(db.consumables[sourceId] ?? []);
        db.procedures[id] = localDB.clone(db.procedures[sourceId] ?? []);
        const sourceSelection = db.fixedCostSelections[sourceId];
        if (sourceSelection) {
          db.fixedCostSelections[id] = {
            includeFixedCosts: payload.includeFixedCosts,
            items: localDB.clone(sourceSelection.items),
          };
          baseline.appliedFixedCostIds = sourceSelection.items
            .filter(item => item.included)
            .map(item => item.templateId);
        }
      }

      return buildBaselineDetail(baseline);
    });
  },
  async updateBaseline(id: string, payload: BaselineUpdatePayload) {
    return localDB.mutate(db => {
      const baseline = db.baselines[id];
      if (!baseline) {
        throw new Error(`Baseline(${id}) not found.`);
      }
      if (payload.status) {
        baseline.status = payload.status;
        if (payload.status !== 'LOCKED') {
          baseline.lockedAt = null;
          baseline.lockedBy = null;
        }
      }
      if (typeof payload.includeFixedCosts === 'boolean') {
        baseline.includeFixedCosts = payload.includeFixedCosts;
      }
      baseline.updatedAt = localDB.now();
      return buildBaselineDetail(baseline);
    });
  },
  async lockBaseline(id: string) {
    localDB.mutate(db => {
      const baseline = db.baselines[id];
      if (!baseline) {
        throw new Error(`Baseline(${id}) not found.`);
      }
      baseline.status = 'LOCKED';
      baseline.lockedAt = localDB.now();
      baseline.lockedBy = null;
      baseline.updatedAt = baseline.lockedAt;
    });
  },
  async unlockBaseline(id: string) {
    localDB.mutate(db => {
      const baseline = db.baselines[id];
      if (!baseline) {
        throw new Error(`Baseline(${id}) not found.`);
      }
      baseline.status = 'DRAFT';
      baseline.lockedAt = null;
      baseline.lockedBy = null;
      baseline.updatedAt = localDB.now();
    });
  },
};

const fixedCostLinkService: FixedCostLinkService = {
  async getSelection(baselineId) {
    ensureBaselineExists(baselineId);
    const db = localDB.load();
    const existing = db.fixedCostSelections[baselineId];
    if (existing) {
      return localDB.clone(existing);
    }
    return {
      includeFixedCosts: true,
      items: [],
    };
  },
  async updateSelection(baselineId, payload) {
    localDB.mutate(db => {
      const baseline = db.baselines[baselineId];
      if (!baseline) {
        throw new Error(`Baseline(${baselineId}) not found.`);
      }
      db.fixedCostSelections[baselineId] = {
        includeFixedCosts: payload.includeFixedCosts,
        items: payload.items.map(item => ({ ...item })),
      };
      baseline.includeFixedCosts = payload.includeFixedCosts;
      baseline.appliedFixedCostIds = payload.items.filter(item => item.included).map(item => item.templateId);
      baseline.updatedAt = localDB.now();
    });
  },
};

const staffDataService: StaffDataService = {
  async getStaff(baselineId) {
    ensureBaselineExists(baselineId);
    const db = localDB.load();
    return localDB.clone(db.staff[baselineId] ?? []);
  },
  async upsertStaff(baselineId, input) {
    ensureBaselineExists(baselineId);
    localDB.mutate(db => {
      db.staff[baselineId] = input.map(entry => ({ ...entry }));
    });
  },
};

const consumableDataService: ConsumableDataService = {
  async getConsumables(baselineId) {
    ensureBaselineExists(baselineId);
    const db = localDB.load();
    return localDB.clone(db.consumables[baselineId] ?? []);
  },
  async upsertConsumables(baselineId, input) {
    ensureBaselineExists(baselineId);
    localDB.mutate(db => {
      db.consumables[baselineId] = input.map(entry => ({ ...entry }));
    });
  },
};

const procedureDataService: ProcedureDataService = {
  async listProcedures(baselineId) {
    ensureBaselineExists(baselineId);
    const definitions = listProceduresInternal(baselineId);
    return definitions.map(buildProcedureSummary);
  },
  async createProcedure(baselineId: string, input: ProcedureDefinitionInput) {
    ensureBaselineExists(baselineId);
    return localDB.mutate(db => {
      const definitions = db.procedures[baselineId] ?? [];
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
      db.procedures[baselineId] = [...definitions, stored];
      return buildProcedureSummary(stored);
    });
  },
  async updateProcedureVariant(baselineId: string, variantId: string, input: ProcedureVariantInput) {
    ensureBaselineExists(baselineId);
    return localDB.mutate(db => {
      const definitions = db.procedures[baselineId] ?? [];
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
  async deleteProcedureVariant(baselineId: string, variantId: string) {
    ensureBaselineExists(baselineId);
    localDB.mutate(db => {
      const definitions = db.procedures[baselineId] ?? [];
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
      db.procedures[baselineId] = definitions;
      const existingResults = db.results[baselineId];
      if (existingResults) {
        existingResults.rows = existingResults.rows.filter(
          row => !(row.procedureName === procedureName && row.variantName === variantLabel)
        );
      }
    });
  },
};

const calculationService: CostingCalculationService = {
  async recalculate(baselineId: string): Promise<RecalculateResponse> {
    const baseline = ensureBaselineExists(baselineId);
    const db = localDB.load();
    const staff = db.staff[baselineId] ?? [];
    const consumables = db.consumables[baselineId] ?? [];
    const procedures = db.procedures[baselineId] ?? [];

    const { rows, insights } = calculateResults(baselineId, baseline, staff, consumables, procedures);
    const queuedAt = localDB.now();
    const completedAt = queuedAt;

    localDB.mutate(mutDB => {
      mutDB.results[baselineId] = {
        rows: rows.map(row => ({ ...row, costBreakdown: { ...row.costBreakdown } })),
        insights: { ...insights },
        lastCalculatedAt: completedAt,
      };
      const targetBaseline = mutDB.baselines[baselineId];
      if (targetBaseline) {
        targetBaseline.lastCalculatedAt = completedAt;
        if (targetBaseline.status === 'DRAFT') {
          targetBaseline.status = 'READY';
        }
        targetBaseline.updatedAt = completedAt;
      }
      const jobId = localDB.generateId();
      mutDB.jobs[jobId] = {
        jobId,
        baselineId,
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
  async getResults(baselineId, params) {
    ensureBaselineExists(baselineId);
    const db = localDB.load();
    const stored = db.results[baselineId];
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
  async getInsights(baselineId) {
    ensureBaselineExists(baselineId);
    const db = localDB.load();
    const stored = db.results[baselineId];
    if (!stored) {
      return {};
    }
    return localDB.clone(stored.insights);
  },
  async exportResults(baselineId, format) {
    ensureBaselineExists(baselineId);
    const rows = await calculationService.getResults(baselineId);
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
  baselineService,
  fixedCostLinkService,
  staffDataService,
  consumableDataService,
  procedureDataService,
  calculationService,
});
