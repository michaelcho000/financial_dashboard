import { FixedCostGroup, FixedCostItem, MaterialItem, MaterialUsage, OperationalConfig, ProcedureCostBreakdown, ProcedureFormValues, StaffAssignment, StaffProfile } from './types';

const MINUTES_IN_HOUR = 60;

export const calculateOperationalMinutes = (config: OperationalConfig): number => {
  if (!config.operatingDays || !config.operatingHoursPerDay) {
    return 0;
  }
  return config.operatingDays * config.operatingHoursPerDay * MINUTES_IN_HOUR;
};

export const calculateStaffMinuteRate = (staff: StaffProfile): number => {
  const totalMinutes = staff.workDaysPerMonth * staff.workHoursPerDay * MINUTES_IN_HOUR;
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

