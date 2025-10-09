import {
  DayOfWeek,
  FixedCostGroup,
  FixedCostItem,
  MaterialItem,
  MaterialUsage,
  OperationalConfig,
  ProcedureActualPerformance,
  ProcedureCostBreakdown,
  ProcedureFormValues,
  StaffAssignment,
  StaffProfile,
  WeeklyOperationalSchedule,
  WeeklyScheduleEntry,
} from './types';

const MINUTES_IN_HOUR = 60;
const DEFAULT_WEEKS_PER_MONTH = 4.345;
const CALENDAR_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const JS_DAY_TO_DAY_OF_WEEK: DayOfWeek[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const parseTimeToMinutes = (time: string | null): number | null => {
  if (!time) {
    return null;
  }
  const [hourStr, minuteStr] = time.split(':');
  if (minuteStr === undefined) {
    return null;
  }
  const hours = Number(hourStr);
  const minutes = Number(minuteStr);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }
  const duration = hours * MINUTES_IN_HOUR + minutes;
  return Number.isFinite(duration) ? duration : null;
};

const sanitizeCalendarMonth = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return CALENDAR_MONTH_PATTERN.test(trimmed) ? trimmed : null;
};

const getCurrentCalendarMonth = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const calculateWeeklyPatternMinutes = (schedule: WeeklyOperationalSchedule): number => {
  return schedule.schedule.reduce((sum, entry) => {
    if (!entry.isOpen) {
      return sum;
    }
    const start = parseTimeToMinutes(entry.startTime);
    const end = parseTimeToMinutes(entry.endTime);
    if (start === null || end === null) {
      return sum;
    }
    const duration = end - start;
    if (!Number.isFinite(duration) || duration <= 0) {
      return sum;
    }
    return sum + duration;
  }, 0);
};

const calculateCalendarMonthMinutes = (
  schedule: WeeklyOperationalSchedule,
): { calendarMonth: string; monthlyMinutes: number; openDays: number } | null => {
  const entriesByDay = new Map<DayOfWeek, WeeklyScheduleEntry>();
  schedule.schedule.forEach(entry => {
    entriesByDay.set(entry.day, entry);
  });

  const sanitized = sanitizeCalendarMonth(schedule.calendarMonth);
  const targetMonth = sanitized ?? getCurrentCalendarMonth();
  const [yearStr, monthStr] = targetMonth.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return null;
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  let monthlyMinutes = 0;
  let openDays = 0;

  for (let day = 1; day <= daysInMonth; day += 1) {
    const jsDate = new Date(year, month - 1, day);
    const dayOfWeek = JS_DAY_TO_DAY_OF_WEEK[jsDate.getDay()];
    const entry = entriesByDay.get(dayOfWeek);
    if (!entry || !entry.isOpen) {
      continue;
    }
    const start = parseTimeToMinutes(entry.startTime);
    const end = parseTimeToMinutes(entry.endTime);
    if (start === null || end === null) {
      continue;
    }
    const duration = end - start;
    if (!Number.isFinite(duration) || duration <= 0) {
      continue;
    }
    monthlyMinutes += duration;
    openDays += 1;
  }

  return {
    calendarMonth: targetMonth,
    monthlyMinutes: Math.round(monthlyMinutes),
    openDays,
  };
};

export interface WeeklyScheduleAnalysis {
  weeklyPatternMinutes: number;
  monthlyMinutesPerBed: number;
  effectiveWeeks: number | null;
  calendarMonth: string | null;
  openDaysInMonth: number | null;
  isCalendarExact: boolean;
}

export const analyzeWeeklySchedule = (schedule: WeeklyOperationalSchedule): WeeklyScheduleAnalysis => {
  const weeklyPatternMinutes = calculateWeeklyPatternMinutes(schedule);
  const calendarBased = calculateCalendarMonthMinutes(schedule);
  if (calendarBased) {
    const effectiveWeeks =
      weeklyPatternMinutes > 0 ? calendarBased.monthlyMinutes / weeklyPatternMinutes : null;
    return {
      weeklyPatternMinutes,
      monthlyMinutesPerBed: calendarBased.monthlyMinutes,
      effectiveWeeks,
      calendarMonth: calendarBased.calendarMonth,
      openDaysInMonth: calendarBased.openDays,
      isCalendarExact: true,
    };
  }

  const fallbackWeeks =
    typeof schedule.weeksPerMonth === 'number' && Number.isFinite(schedule.weeksPerMonth) && schedule.weeksPerMonth > 0
      ? schedule.weeksPerMonth
      : DEFAULT_WEEKS_PER_MONTH;
  const monthlyMinutesPerBed = Math.round(weeklyPatternMinutes * fallbackWeeks);
  return {
    weeklyPatternMinutes,
    monthlyMinutesPerBed,
    effectiveWeeks: fallbackWeeks,
    calendarMonth: null,
    openDaysInMonth: null,
    isCalendarExact: false,
  };
};

export const calculateOperationalMinutes = (config: OperationalConfig): number => {
  const bedCount = config.bedCount ?? 1;
  if (!Number.isFinite(bedCount) || bedCount <= 0) {
    return 0;
  }

  let baseMinutes = 0;
  if (config.mode === 'weekly') {
    const analysis = analyzeWeeklySchedule(config.weekly);
    baseMinutes = analysis.monthlyMinutesPerBed;
  } else {
    const days = config.simple.operatingDays;
    const hours = config.simple.operatingHoursPerDay;
    if (Number.isFinite(days) && Number.isFinite(hours) && days && hours) {
      baseMinutes = days * hours * MINUTES_IN_HOUR;
    }
  }

  if (!baseMinutes) {
    return 0;
  }

  return Math.round(baseMinutes * bedCount);
};

export const calculateWeeklyOperationalMinutes = (schedule: WeeklyOperationalSchedule): number => {
  return calculateWeeklyPatternMinutes(schedule);
};

const getStaffMonthlyMinutes = (staff: StaffProfile): number => {
  const derived = staff.workPattern?.derivedMonthlyMinutes;
  if (typeof derived === 'number' && Number.isFinite(derived) && derived > 0) {
    return derived;
  }
  const fallback = staff.workDaysPerMonth * staff.workHoursPerDay * MINUTES_IN_HOUR;
  return Number.isFinite(fallback) ? fallback : 0;
};

export const calculateStaffMinuteRate = (staff: StaffProfile): number => {
  const totalMinutes = getStaffMonthlyMinutes(staff);
  if (!totalMinutes) {
    return 0;
  }
  return staff.monthlySalary / totalMinutes;
};

const calculateDirectLaborCost = (assignments: StaffAssignment[], staffList: StaffProfile[]): number => {
  return assignments.reduce((sum, assignment) => {
    const staff = staffList.find(item => item.id === assignment.staffId);
    if (!staff) {
      return sum;
    }
    const minuteRate = calculateStaffMinuteRate(staff);
    return sum + minuteRate * assignment.minutes;
  }, 0);
};

export const calculateMaterialUnitCost = (material: MaterialItem): number => {
  if (!material.unitQuantity) {
    return 0;
  }
  return material.unitPrice / material.unitQuantity;
};

const calculateMaterialCost = (usages: MaterialUsage[], materials: MaterialItem[]): number => {
  return usages.reduce((sum, usage) => {
    const material = materials.find(item => item.id === usage.materialId);
    if (!material) {
      return sum;
    }
    const pricePerUnit = calculateMaterialUnitCost(material);
    return sum + pricePerUnit * usage.quantity;
  }, 0);
};

export const calculateMonthlyFixedTotal = (fixedCosts: FixedCostItem[], group?: FixedCostGroup): number =>
  fixedCosts.reduce((sum, item) => {
    if (group && item.costGroup !== group) {
      return sum;
    }
    return sum + item.monthlyAmount;
  }, 0);

export const summarizeFixedCosts = (fixedCosts: FixedCostItem[]): {
  facilityTotal: number;
  commonTotal: number;
  marketingTotal: number;
  total: number;
} => {
  const facilityTotal = calculateMonthlyFixedTotal(fixedCosts, 'facility');
  const commonTotal = calculateMonthlyFixedTotal(fixedCosts, 'common');
  const marketingTotal = calculateMonthlyFixedTotal(fixedCosts, 'marketing');
  return {
    facilityTotal,
    commonTotal,
    marketingTotal,
    total: facilityTotal + commonTotal + marketingTotal,
  };
};

const calculateFixedCostPerMinute = (fixedCosts: FixedCostItem[], operationalMinutes: number): number => {
  if (!operationalMinutes) {
    return 0;
  }
  const facilityFixed = calculateMonthlyFixedTotal(fixedCosts, 'facility');
  return facilityFixed / operationalMinutes;
};

const calculateBreakevenUnits = (price: number, directCost: number, monthlyFacilityFixed: number): number | null => {
  const contribution = price - directCost;
  if (contribution <= 0) {
    return null;
  }
  return monthlyFacilityFixed / contribution;
};

export const buildProcedureBreakdown = (procedure: ProcedureFormValues, context: {
  staff: StaffProfile[];
  materials: MaterialItem[];
  fixedCosts: FixedCostItem[];
  operational: OperationalConfig;
}): ProcedureCostBreakdown => {
  const directLaborCost = calculateDirectLaborCost(procedure.staffAssignments, context.staff);
  const consumableCost = calculateMaterialCost(procedure.materialUsages, context.materials);
  const operationalMinutes = calculateOperationalMinutes(context.operational);
  const fixedCostPerMinute = calculateFixedCostPerMinute(context.fixedCosts, operationalMinutes);
  const fixedCostAllocated = fixedCostPerMinute * (procedure.totalMinutes || 0);
  const totalCost = directLaborCost + consumableCost + fixedCostAllocated;
  const margin = procedure.price - totalCost;
  const marginRate = procedure.price ? (margin / procedure.price) * 100 : 0;
  const monthlyFacilityFixed = calculateMonthlyFixedTotal(context.fixedCosts, 'facility');
  const breakevenUnits = calculateBreakevenUnits(
    procedure.price,
    directLaborCost + consumableCost,
    monthlyFacilityFixed,
  );

  return {
    procedureId: procedure.id,
    directLaborCost,
    consumableCost,
    fixedCostAllocated,
    totalCost,
    margin,
    marginRate,
    breakevenUnits,
  };
};

export const buildAllBreakdowns = (procedures: ProcedureFormValues[], context: {
  staff: StaffProfile[];
  materials: MaterialItem[];
  fixedCosts: FixedCostItem[];
  operational: OperationalConfig;
}): ProcedureCostBreakdown[] => {
  return procedures.map(procedure => buildProcedureBreakdown(procedure, context));
};

export interface LaborCostAllocationSummary {
  totalPayroll: number;
  allocatedLaborCost: number;
  unallocatedLaborCost: number;
  allocationRate: number;
}

export const calculateLaborCostAllocation = (context: {
  staff: StaffProfile[];
  breakdowns: ProcedureCostBreakdown[];
  actuals: ProcedureActualPerformance[];
}): LaborCostAllocationSummary => {
  const totalPayroll = context.staff.reduce(
    (sum, profile) => sum + (Number.isFinite(profile.monthlySalary) ? profile.monthlySalary : 0),
    0,
  );

  if (!context.actuals.length || !context.breakdowns.length) {
    return {
      totalPayroll,
      allocatedLaborCost: 0,
      unallocatedLaborCost: Math.max(0, totalPayroll),
      allocationRate: 0,
    };
  }

  const breakdownMap = new Map(context.breakdowns.map(item => [item.procedureId, item]));
  const allocatedLaborCost = context.actuals.reduce((sum, actual) => {
    const breakdown = breakdownMap.get(actual.procedureId);
    if (!breakdown) {
      return sum;
    }
    const performed = Number.isFinite(actual.performed) ? actual.performed : 0;
    if (performed <= 0) {
      return sum;
    }
    return sum + breakdown.directLaborCost * performed;
  }, 0);

  const unallocatedLaborCost = Math.max(0, totalPayroll - allocatedLaborCost);
  const allocationRate = totalPayroll > 0 ? allocatedLaborCost / totalPayroll : 0;

  return {
    totalPayroll,
    allocatedLaborCost,
    unallocatedLaborCost,
    allocationRate,
  };
};

export interface UnallocatedLaborAllocationEntry {
  procedureId: string;
  additionalUnitCost: number;
  additionalTotalCost: number;
  totalActualMinutes: number;
}

export interface UnallocatedLaborAllocationResult {
  perMinuteCost: number;
  totalActualMinutes: number;
  entries: UnallocatedLaborAllocationEntry[];
}

const getProcedureMinutesPerUnit = (procedure: ProcedureFormValues): number => {
  if (Number.isFinite(procedure.totalMinutes) && procedure.totalMinutes > 0) {
    return procedure.totalMinutes;
  }
  if (Number.isFinite(procedure.treatmentMinutes) && procedure.treatmentMinutes > 0) {
    return procedure.treatmentMinutes;
  }
  return 0;
};

export const allocateUnallocatedLaborCost = (context: {
  procedures: ProcedureFormValues[];
  actuals: ProcedureActualPerformance[];
  unallocatedLaborCost: number;
}): UnallocatedLaborAllocationResult => {
  const { unallocatedLaborCost } = context;
  if (!Number.isFinite(unallocatedLaborCost) || unallocatedLaborCost <= 0) {
    return {
      perMinuteCost: 0,
      totalActualMinutes: 0,
      entries: [],
    };
  }

  const procedureMap = new Map(context.procedures.map(item => [item.id, item]));
  const minutesByProcedure = new Map<string, number>();

  let totalActualMinutes = 0;
  context.actuals.forEach(actual => {
    const procedure = procedureMap.get(actual.procedureId);
    if (!procedure) {
      return;
    }
    const performed = Number.isFinite(actual.performed) ? actual.performed : 0;
    if (performed <= 0) {
      return;
    }
    const minutesPerUnit = getProcedureMinutesPerUnit(procedure);
    if (!minutesPerUnit) {
      return;
    }
    const totalMinutes = minutesPerUnit * performed;
    if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
      return;
    }
    minutesByProcedure.set(actual.procedureId, (minutesByProcedure.get(actual.procedureId) ?? 0) + totalMinutes);
    totalActualMinutes += totalMinutes;
  });

  if (totalActualMinutes <= 0) {
    return {
      perMinuteCost: 0,
      totalActualMinutes: 0,
      entries: [],
    };
  }

  const perMinuteCost = unallocatedLaborCost / totalActualMinutes;
  const entries: UnallocatedLaborAllocationEntry[] = [];

  minutesByProcedure.forEach((procedureMinutes, procedureId) => {
    const procedure = procedureMap.get(procedureId);
    if (!procedure) {
      return;
    }
    const minutesPerUnit = getProcedureMinutesPerUnit(procedure);
    const additionalUnitCost = minutesPerUnit ? perMinuteCost * minutesPerUnit : 0;
    const additionalTotalCost = perMinuteCost * procedureMinutes;
    entries.push({
      procedureId,
      additionalUnitCost,
      additionalTotalCost,
      totalActualMinutes: procedureMinutes,
    });
  });

  return {
    perMinuteCost,
    totalActualMinutes,
    entries,
  };
};
