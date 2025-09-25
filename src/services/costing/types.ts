export type BaselineStatus = 'DRAFT' | 'READY' | 'LOCKED';

export interface BaselineSummary {
  id: string;
  month: string; // YYYY-MM
  status: BaselineStatus;
  includeFixedCosts: boolean;
  lockedAt: string | null;
  lastCalculatedAt: string | null;
  createdAt: string;
}

export interface BaselineDetail extends BaselineSummary {
  appliedFixedCostIds: string[];
}

export interface BaselineCreatePayload {
  month: string;
  sourceBaselineId?: string | null;
  includeFixedCosts: boolean;
}

export interface BaselineUpdatePayload {
  status?: BaselineStatus;
  includeFixedCosts?: boolean;
}

export interface FixedCostItemState {
  templateId: string;
  name: string;
  monthlyCost: number;
  defaultIncluded: boolean;
  included: boolean;
}

export interface FixedCostSelectionPayload {
  includeFixedCosts: boolean;
  items: FixedCostItemState[];
}

export interface StaffCapacityInput {
  roleId?: string;
  roleName: string;
  monthlyPayroll: number;
  availableMinutes: number;
}

export interface ConsumablePricingInput {
  consumableId?: string;
  consumableName: string;
  purchaseCost: number;
  yieldQuantity: number;
  unit: string;
}

export interface ProcedureStaffMixInput {
  roleId?: string;
  roleName: string;
  participants: number;
  minutes: number;
}

export interface ProcedureConsumableUsageInput {
  consumableId?: string;
  consumableName: string;
  quantity: number;
  unit: string;
}

export interface ProcedureEquipmentLinkInput {
  fixedCostTemplateId: string;
  notes?: string;
}

export interface ProcedureVariantInput {
  variantId?: string;
  label: string;
  salePrice: number;
  totalMinutes: number;
  equipmentMinutes?: number | null;
  fixedCostTemplateId?: string | null;
  staffMix: ProcedureStaffMixInput[];
  consumables: ProcedureConsumableUsageInput[];
  equipmentLinks: ProcedureEquipmentLinkInput[];
}

export interface ProcedureDefinitionInput {
  procedureId?: string;
  name: string;
  variants: ProcedureVariantInput[];
}

export interface ProcedureVariantSummary {
  variantId: string;
  label: string;
  salePrice: number;
  totalMinutes: number;
  staffMix: ProcedureStaffMixInput[];
  consumables: ProcedureConsumableUsageInput[];
  equipmentLinks: ProcedureEquipmentLinkInput[];
}

export interface ProcedureSummary {
  procedureId: string;
  name: string;
  variants: ProcedureVariantSummary[];
}

export interface CostBreakdown {
  labor: number;
  consumables: number;
  facilityFixed: number;
  equipmentFixed: number;
  [key: string]: number;
}

export interface CostingResultRow {
  procedureName: string;
  variantName: string;
  caseCount: number;
  salePrice: number;
  totalCost: number;
  margin: number;
  marginRate: number;
  marginPerMinute?: number | null;
  costBreakdown: CostBreakdown;
}

export interface MomChangeMetric {
  current: number;
  previous: number | null;
  change: number | null;
}

export interface InsightPayload {
  topByVolume?: { procedureId: string; cases: number } | null;
  topByMargin?: { procedureId: string; margin: number } | null;
  lowestMarginRate?: { procedureId: string; marginRate: number } | null;
  mom?: {
    volume?: MomChangeMetric;
    margin?: MomChangeMetric;
  };
  notes?: string | null;
}

export interface RecalculateResponse {
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED';
  queuedAt: string;
  completedAt?: string;
}

export interface CostingBaselineService {
  listBaselines(): Promise<BaselineSummary[]>;
  getBaseline(id: string): Promise<BaselineDetail>;
  createBaseline(payload: BaselineCreatePayload): Promise<BaselineDetail>;
  updateBaseline(id: string, payload: BaselineUpdatePayload): Promise<BaselineDetail>;
  lockBaseline(id: string): Promise<void>;
  unlockBaseline(id: string): Promise<void>;
}

export interface FixedCostLinkService {
  getSelection(baselineId: string): Promise<{ includeFixedCosts: boolean; items: FixedCostItemState[] }>;
  updateSelection(baselineId: string, payload: FixedCostSelectionPayload): Promise<void>;
}

export interface StaffDataService {
  getStaff(baselineId: string): Promise<StaffCapacityInput[]>;
  upsertStaff(baselineId: string, input: StaffCapacityInput[]): Promise<void>;
}

export interface ConsumableDataService {
  getConsumables(baselineId: string): Promise<ConsumablePricingInput[]>;
  upsertConsumables(baselineId: string, input: ConsumablePricingInput[]): Promise<void>;
}

export interface ProcedureDataService {
  listProcedures(baselineId: string): Promise<ProcedureSummary[]>;
  createProcedure(baselineId: string, input: ProcedureDefinitionInput): Promise<ProcedureSummary>;
  updateProcedureVariant(baselineId: string, variantId: string, input: ProcedureVariantInput): Promise<ProcedureSummary>;
  deleteProcedureVariant(baselineId: string, variantId: string): Promise<void>;
}

export interface CostingCalculationService {
  recalculate(baselineId: string): Promise<RecalculateResponse>;
  getResults(baselineId: string, params?: { sort?: string; order?: 'asc' | 'desc'; search?: string }): Promise<CostingResultRow[]>;
  getInsights(baselineId: string): Promise<InsightPayload>;
  exportResults(baselineId: string, format: 'csv' | 'xlsx'): Promise<Blob | ArrayBuffer>;
}
