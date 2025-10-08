export type OperationalScheduleMode = 'simple' | 'weekly';

export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

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
  notes?: string;
}

export interface StaffAssignment {
  staffId: string;
  minutes: number;
}

export interface MaterialItem {
  id: string;
  name: string;
  unitLabel: string; // e.g. shot, cc, vial
  unitQuantity: number; // quantity per base unit (e.g. 2400 shots)
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
  quantity: number; // usage expressed in unitLabel
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

export interface StandaloneCostingState {
  operational: OperationalConfig;
  equipment: EquipmentProfile[];
  useEquipmentHierarchy: boolean;
  staff: StaffProfile[];
  materials: MaterialItem[];
  fixedCosts: FixedCostItem[];
  procedures: ProcedureFormValues[];
  breakdowns: ProcedureCostBreakdown[];
  lastSavedAt: string | null;
}

export interface StandaloneCostingDraft {
  state: StandaloneCostingState;
  version: number;
}
