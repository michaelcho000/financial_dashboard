export type SnapshotStatus = 'DRAFT' | 'READY' | 'LOCKED';

export interface SnapshotSummary {
  id: string;
  month: string; // YYYY-MM
  status: SnapshotStatus;
  includeFixedCosts: boolean;
  lockedAt: string | null;
  lastCalculatedAt: string | null;
  createdAt: string;
}

export interface SnapshotDetail extends SnapshotSummary {
  appliedFixedCostIds: string[];
}

export interface SnapshotCreatePayload {
  month: string;
  sourceSnapshotId?: string | null;
  includeFixedCosts: boolean;
}

export interface SnapshotUpdatePayload {
  status?: SnapshotStatus;
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
  items: Array<{ templateId: string; included: boolean }>;
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

export interface CostingSnapshotService {
  listSnapshots(): Promise<SnapshotSummary[]>;
  getSnapshot(id: string): Promise<SnapshotDetail>;
  createSnapshot(payload: SnapshotCreatePayload): Promise<SnapshotDetail>;
  updateSnapshot(id: string, payload: SnapshotUpdatePayload): Promise<SnapshotDetail>;
  lockSnapshot(id: string): Promise<void>;
  unlockSnapshot(id: string): Promise<void>;
}

export interface FixedCostLinkService {
  getSelection(snapshotId: string): Promise<{ includeFixedCosts: boolean; items: FixedCostItemState[] }>;
  updateSelection(snapshotId: string, payload: FixedCostSelectionPayload): Promise<void>;
}

export interface StaffDataService {
  getStaff(snapshotId: string): Promise<StaffCapacityInput[]>;
  upsertStaff(snapshotId: string, input: StaffCapacityInput[]): Promise<void>;
}

export interface ConsumableDataService {
  getConsumables(snapshotId: string): Promise<ConsumablePricingInput[]>;
  upsertConsumables(snapshotId: string, input: ConsumablePricingInput[]): Promise<void>;
}

export interface ProcedureDataService {
  listProcedures(snapshotId: string): Promise<ProcedureSummary[]>;
  createProcedure(snapshotId: string, input: ProcedureDefinitionInput): Promise<ProcedureSummary>;
  updateProcedureVariant(snapshotId: string, variantId: string, input: ProcedureVariantInput): Promise<ProcedureSummary>;
  deleteProcedureVariant(snapshotId: string, variantId: string): Promise<void>;
}

export interface CostingCalculationService {
  recalculate(snapshotId: string): Promise<RecalculateResponse>;
  getResults(snapshotId: string, params?: { sort?: string; order?: 'asc' | 'desc'; search?: string }): Promise<CostingResultRow[]>;
  getInsights(snapshotId: string): Promise<InsightPayload>;
  exportResults(snapshotId: string, format: 'csv' | 'xlsx'): Promise<Blob | ArrayBuffer>;
}
