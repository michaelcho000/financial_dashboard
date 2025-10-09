export type OperationalScheduleMode = 'simple' | 'weekly';

export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export type CostingPhaseId =
  | 'operational'
  | 'staff'
  | 'materials'
  | 'fixedCosts'
  | 'procedures'
  | 'catalog'
  | 'results'
  | 'marketing';

export interface CostingPhaseStatus {
  lastSavedAt: string | null;
  checksum: string | null;
}

export interface SimpleOperationalSchedule {
  operatingDays: number | null;
  operatingHoursPerDay: number | null;
}

export interface WeeklyScheduleEntry {
  day: DayOfWeek;
  isOpen: boolean;
  startTime: string | null;
  endTime: string | null;
}

export interface WeeklyOperationalSchedule {
  schedule: WeeklyScheduleEntry[];
  weeksPerMonth: number | null;
  calendarMonth: string | null;
}

export interface StaffWorkPatternMonthly {
  workDaysPerMonth: number;
  workHoursPerDay: number;
}

export interface StaffWorkPatternWeeklyByHours {
  workDaysPerWeek: number;
  workHoursPerWeek: number | null;
  workHoursPerDay: number | null;
}

export interface StaffWorkPatternDaily {
  workDaysPerWeek: number;
  workHoursPerDay: number;
}

export interface StaffWorkPattern {
  basis: 'monthly' | 'weekly' | 'daily';
  monthly: StaffWorkPatternMonthly | null;
  weekly: StaffWorkPatternWeeklyByHours | null;
  daily: StaffWorkPatternDaily | null;
  effectiveWeeksPerMonth: number | null;
  derivedMonthlyMinutes: number;
  derivedWeeklyMinutes: number | null;
}

export interface OperationalConfig {
  mode: OperationalScheduleMode;
  simple: SimpleOperationalSchedule;
  weekly: WeeklyOperationalSchedule;
  bedCount: number | null;
  notes?: string;
}

export interface StaffProfile {
  id: string;
  name: string;
  role: string;
  monthlySalary: number;
  workDaysPerMonth: number;
  workHoursPerDay: number;
  workPattern?: StaffWorkPattern | null;
  notes?: string;
}

export interface StaffAssignment {
  staffId: string;
  minutes: number;
}

export interface MaterialItem {
  id: string;
  name: string;
  unitLabel: string;
  unitQuantity: number;
  unitPrice: number;
  notes?: string;
}

export interface EquipmentProfile {
  id: string;
  name: string;
  leaseCost: number;
  notes?: string;
}

export interface MaterialUsage {
  materialId: string;
  quantity: number;
}

export type FixedCostGroup = 'facility' | 'common' | 'marketing';

export interface FixedCostItem {
  id: string;
  name: string;
  monthlyAmount: number;
  costGroup: FixedCostGroup;
  notes?: string;
}

export interface ProcedureFormValues {
  id: string;
  name: string;
  price: number;
  treatmentMinutes: number;
  totalMinutes: number;
  staffAssignments: StaffAssignment[];
  materialUsages: MaterialUsage[];
  notes?: string;
}

export interface ProcedureCostBreakdown {
  procedureId: string;
  directLaborCost: number;
  consumableCost: number;
  fixedCostAllocated: number;
  totalCost: number;
  margin: number;
  marginRate: number;
  breakevenUnits: number | null;
}

export interface ProcedureActualPerformance {
  procedureId: string;
  performed: number;
  marketingSpend?: number | null;
  notes?: string;
}

export interface MarketingSettings {
  targetRevenue: number | null;
  manualMarketingBudget: number | null;
  manualMarketingAllocations: Record<string, number>;
}

export interface StandaloneCostingState {
  operational: OperationalConfig;
  equipment: EquipmentProfile[];
  useEquipmentHierarchy: boolean;
  staff: StaffProfile[];
  phaseStatuses: Record<CostingPhaseId, CostingPhaseStatus>;
  materials: MaterialItem[];
  fixedCosts: FixedCostItem[];
  procedures: ProcedureFormValues[];
  breakdowns: ProcedureCostBreakdown[];
  procedureActuals: ProcedureActualPerformance[];
  marketingSettings: MarketingSettings;
  lastSavedAt: string | null;
  resultsIncludeUnallocatedLabor: boolean;
}

export interface StandaloneCostingDraft {
  state: StandaloneCostingState;
  version: number;
}
