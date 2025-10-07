import {
  BaselineCreatePayload,
  BaselineDetail,
  BaselineSummary,
  BaselineUpdatePayload,
  ConsumableDataService,
  ConsumablePricingInput,
  CostBreakdown,
  CostingBaselineService,
  CostingCalculationService,
  CostingResultRow,
  FixedCostLinkService,
  InsightPayload,
  ProcedureDataService,
  ProcedureDefinitionInput,
  ProcedureSummary,
  ProcedureVariantInput,
  ProcedureVariantSummary,
  RecalculateResponse,
  StaffCapacityInput,
  StaffDataService,
} from '../types';
import { CostingServicesBundle } from '../factory';
import {
  supabaseCostingDB,
  StoredBaseline,
  StoredProcedureDefinition,
  StoredProcedureVariant,
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

const buildVariantSummary = (variant: StoredProcedureVariant): ProcedureVariantSummary => ({
  variantId: variant.id,
  label: variant.label,
  salePrice: variant.salePrice,
  totalMinutes: variant.totalMinutes,
  staffMix: supabaseCostingDB.clone(variant.staffMix),
  consumables: supabaseCostingDB.clone(variant.consumables),
  equipmentLinks: supabaseCostingDB.clone(variant.equipmentLinks),
});

const buildProcedureSummary = (definition: StoredProcedureDefinition): ProcedureSummary => ({
  procedureId: definition.id,
  name: definition.name,
  variants: definition.variants.map(buildVariantSummary),
});

const ensureBaselineExists = async (baselineId: string): Promise<StoredBaseline> => {
  const db = await supabaseCostingDB.load();
  const baseline = db.baselines[baselineId];
  if (!baseline) {
    throw new Error(`Baseline(${baselineId}) not found.`);
  }
  return baseline;
};

const listProceduresInternal = async (baselineId: string): Promise<StoredProcedureDefinition[]> => {
  const db = await supabaseCostingDB.load();
  return supabaseCostingDB.clone(db.procedures[baselineId] ?? []);
};

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
    const db = await supabaseCostingDB.load();
    return Object.values(db.baselines)
      .map(buildBaselineSummary)
      .sort((a, b) => b.month.localeCompare(a.month));
  },
  async getBaseline(id: string) {
    const baseline = await ensureBaselineExists(id);
    return buildBaselineDetail(baseline);
  },
  async createBaseline(payload: BaselineCreatePayload) {
    return supabaseCostingDB.mutate(db => {
      if (Object.values(db.baselines).some(entry => entry.month === payload.month)) {
        throw new Error(`Baseline for month ${payload.month} already exists.`);
      }

      const id = supabaseCostingDB.generateId();
      const timestamp = supabaseCostingDB.now();
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
        db.staff[id] = supabaseCostingDB.clone(db.staff[sourceId] ?? []);
        db.consumables[id] = supabaseCostingDB.clone(db.consumables[sourceId] ?? []);
        db.procedures[id] = supabaseCostingDB.clone(db.procedures[sourceId] ?? []);
        const sourceSelection = db.fixedCostSelections[sourceId];
        if (sourceSelection) {
          db.fixedCostSelections[id] = {
            includeFixedCosts: payload.includeFixedCosts,
            items: supabaseCostingDB.clone(sourceSelection.items),
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
    return supabaseCostingDB.mutate(db => {
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
      baseline.updatedAt = supabaseCostingDB.now();
      return buildBaselineDetail(baseline);
    });
  },
  async lockBaseline(id: string) {
    await supabaseCostingDB.mutate(db => {
      const baseline = db.baselines[id];
      if (!baseline) {
        throw new Error(`Baseline(${id}) not found.`);
      }
      const timestamp = supabaseCostingDB.now();
      baseline.status = 'LOCKED';
      baseline.lockedAt = timestamp;
      baseline.lockedBy = null;
      baseline.updatedAt = timestamp;
    });
  },
  async unlockBaseline(id: string) {
    await supabaseCostingDB.mutate(db => {
      const baseline = db.baselines[id];
      if (!baseline) {
        throw new Error(`Baseline(${id}) not found.`);
      }
      baseline.status = 'DRAFT';
      baseline.lockedAt = null;
      baseline.lockedBy = null;
      baseline.updatedAt = supabaseCostingDB.now();
    });
  },
};

const fixedCostLinkService: FixedCostLinkService = {
  async getSelection(baselineId) {
    await ensureBaselineExists(baselineId);
    const db = await supabaseCostingDB.load();
    const existing = db.fixedCostSelections[baselineId];
    if (existing) {
      return supabaseCostingDB.clone(existing);
    }
    return {
      includeFixedCosts: true,
      items: [],
    };
  },
  async updateSelection(baselineId, payload) {
    await supabaseCostingDB.mutate(db => {
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
      baseline.updatedAt = supabaseCostingDB.now();
    });
  },
};

const staffDataService: StaffDataService = {
  async getStaff(baselineId) {
    await ensureBaselineExists(baselineId);
    const db = await supabaseCostingDB.load();
    return supabaseCostingDB.clone(db.staff[baselineId] ?? []);
  },
  async upsertStaff(baselineId, input) {
    await ensureBaselineExists(baselineId);
    await supabaseCostingDB.mutate(db => {
      db.staff[baselineId] = input.map(entry => ({ ...entry }));
    });
  },
};

const consumableDataService: ConsumableDataService = {
  async getConsumables(baselineId) {
    await ensureBaselineExists(baselineId);
    const db = await supabaseCostingDB.load();
    return supabaseCostingDB.clone(db.consumables[baselineId] ?? []);
  },
  async upsertConsumables(baselineId, input) {
    await ensureBaselineExists(baselineId);
    await supabaseCostingDB.mutate(db => {
      db.consumables[baselineId] = input.map(entry => ({ ...entry }));
    });
  },
};

const procedureDataService: ProcedureDataService = {
  async listProcedures(baselineId) {
    await ensureBaselineExists(baselineId);
    const definitions = await listProceduresInternal(baselineId);
    return definitions.map(buildProcedureSummary);
  },
  async createProcedure(baselineId, input) {
    await ensureBaselineExists(baselineId);
    return supabaseCostingDB.mutate(db => {
      const definitions = db.procedures[baselineId] ?? [];
      const newId = input.procedureId ?? supabaseCostingDB.generateId();
      if (definitions.some(def => def.id === newId)) {
        throw new Error(`Procedure(${newId}) already exists.`);
      }
      const stored: StoredProcedureDefinition = {
        id: newId,
        name: input.name,
        variants: input.variants.map(variant => ({
          id: variant.variantId ?? supabaseCostingDB.generateId(),
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
  async updateProcedureVariant(baselineId, variantId, input) {
    await ensureBaselineExists(baselineId);
    return supabaseCostingDB.mutate(db => {
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
  async deleteProcedureVariant(baselineId, variantId) {
    await ensureBaselineExists(baselineId);
    await supabaseCostingDB.mutate(db => {
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
    const db = await supabaseCostingDB.load();
    const baseline = db.baselines[baselineId];
    if (!baseline) {
      throw new Error(`Baseline(${baselineId}) not found.`);
    }
    const staff = db.staff[baselineId] ?? [];
    const consumables = db.consumables[baselineId] ?? [];
    const procedures = db.procedures[baselineId] ?? [];

    const { rows, insights } = calculateResults(baselineId, baseline, staff, consumables, procedures);
    const queuedAt = supabaseCostingDB.now();
    const completedAt = queuedAt;

    await supabaseCostingDB.mutate(mutDB => {
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
      const jobId = supabaseCostingDB.generateId();
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
    await ensureBaselineExists(baselineId);
    const db = await supabaseCostingDB.load();
    const stored = db.results[baselineId];
    if (!stored) {
      return [];
    }
    let rows = supabaseCostingDB.clone(stored.rows);
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
    await ensureBaselineExists(baselineId);
    const db = await supabaseCostingDB.load();
    const stored = db.results[baselineId];
    if (!stored) {
      return {};
    }
    return supabaseCostingDB.clone(stored.insights);
  },
  async exportResults(baselineId, format) {
    await ensureBaselineExists(baselineId);
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

export const createSupabaseCostingServices = (): CostingServicesBundle => ({
  baselineService,
  fixedCostLinkService,
  staffDataService,
  consumableDataService,
  procedureDataService,
  calculationService,
});
