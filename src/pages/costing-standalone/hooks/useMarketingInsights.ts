import { useMemo } from 'react';
import {
  OperationalConfig,
  ProcedureActualPerformance,
  ProcedureCostBreakdown,
  ProcedureFormValues,
  StandaloneCostingState,
  StaffProfile,
} from '../../../services/standaloneCosting/types';
import { calculateLaborCostAllocation } from '../../../services/standaloneCosting/calculations';

const MINUTES_IN_HOUR = 60;
const DEFAULT_WEEKS_PER_MONTH = 4.345;

const parseTimeToMinutes = (value: string | null | undefined): number => {
  if (typeof value !== 'string') {
    return 0;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }
  const [hour, minute] = trimmed.split(':');
  const hours = Number(hour);
  const minutes = Number(minute);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 0;
  }
  return hours * MINUTES_IN_HOUR + minutes;
};

const deriveCategoryFromName = (name: string): string => {
  if (!name) {
    return '기타';
  }
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) {
    return '기타';
  }
  return parts[0];
};

const computeMonthlyOperationalMinutes = (operational: OperationalConfig): number => {
  if (operational.mode === 'weekly') {
    const weeklyMinutes = operational.weekly.schedule.reduce((acc, entry) => {
      if (!entry.isOpen) {
        return acc;
      }
      const start = parseTimeToMinutes(entry.startTime);
      const end = parseTimeToMinutes(entry.endTime);
      if (end <= start) {
        return acc;
      }
      return acc + (end - start);
    }, 0);
    const weeks =
      typeof operational.weekly.weeksPerMonth === 'number' && Number.isFinite(operational.weekly.weeksPerMonth)
        ? operational.weekly.weeksPerMonth
        : DEFAULT_WEEKS_PER_MONTH;
    return weeklyMinutes * weeks;
  }

  const days = operational.simple.operatingDays;
  const hoursPerDay = operational.simple.operatingHoursPerDay;
  if (typeof days === 'number' && typeof hoursPerDay === 'number' && days > 0 && hoursPerDay > 0) {
    return days * hoursPerDay * MINUTES_IN_HOUR;
  }

  // fallback to weekly schedule if simple mode lacks data
  const weeklyMinutes = operational.weekly.schedule.reduce((acc, entry) => {
    if (!entry.isOpen) {
      return acc;
    }
    const start = parseTimeToMinutes(entry.startTime);
    const end = parseTimeToMinutes(entry.endTime);
    if (end <= start) {
      return acc;
    }
    return acc + (end - start);
  }, 0);
  const weeks =
    typeof operational.weekly.weeksPerMonth === 'number' && Number.isFinite(operational.weekly.weeksPerMonth)
      ? operational.weekly.weeksPerMonth
      : DEFAULT_WEEKS_PER_MONTH;
  if (weeklyMinutes > 0) {
    return weeklyMinutes * weeks;
  }
  // conservative default: 22일 × 8시간
  return 22 * 8 * MINUTES_IN_HOUR;
};

export interface ProcedureInsight {
  id: string;
  name: string;
  category: string;
  price: number;
  totalCost: number;
  directLaborCost: number;
  consumableCost: number;
  fixedCostAllocated: number;
  unitMargin: number;
  marginRate: number;
  breakevenUnits: number | null;
  breakevenGap: number | null;
  performed: number;
  revenue: number;
  profit: number;
  marketingSpend: number | null;
  roas: number | null;
  cac: number | null;
  demandShare: number;
  profitShare: number;
  staffMinutes: number;
  totalStaffMinutes: number;
  totalLaborCost: number;
  totalConsumableCost: number;
  totalFixedCostAllocated: number;
  treatmentMinutes: number;
  totalTreatmentMinutes: number;
  staffAssignments: Array<{
    staffId: string;
    minutesPerUnit: number;
    totalMinutes: number;
  }>;
}

export interface CategoryInsight {
  name: string;
  totalPerformed: number;
  totalRevenue: number;
  avgMarginRate: number;
  leader: ProcedureInsight | null;
  laggard: ProcedureInsight | null;
}

export interface StaffUtilizationInsight {
  staffId: string;
  name: string;
  role: string;
  availableMinutes: number;
  requiredMinutes: number;
  utilization: number | null;
}

export interface BedSimulationResult {
  beds: number;
  utilization: number | null;
  spareMinutes: number;
  additionalBedsNeeded: number | null;
}

export interface BedUtilizationInsight {
  currentBeds: number;
  perBedCapacityMinutes: number;
  totalCapacityMinutes: number;
  requiredMinutes: number;
  utilization: number | null;
  recommendedBeds: number | null;
  simulate: (beds: number) => BedSimulationResult;
}

export interface MarketingInsightsResult {
  procedures: ProcedureInsight[];
  categories: CategoryInsight[];
  staffUtilization: StaffUtilizationInsight[];
  bedUtilization: BedUtilizationInsight;
  summary: {
    totalRevenue: number;
    totalProfit: number;
    totalPerformed: number;
    totalMarketingSpend: number;
    averageMarginRate: number;
    totalStaffMinutesActual: number;
    totalLaborCostActual: number;
    totalConsumableSpend: number;
    averageLaborCostPerMinute: number;
    totalFixedCostAllocatedActual: number;
    averageFixedCostPerProcedure: number;
    totalStaffPayroll: number;
    allocatedLaborCost: number;
    unallocatedLaborCost: number;
    laborAllocationRate: number;
    topMarginProcedures: ProcedureInsight[];
    lowMarginProcedures: ProcedureInsight[];
    growthCandidates: ProcedureInsight[];
    pruneCandidates: ProcedureInsight[];
  };
}

const buildProcedureInsights = (
  procedures: ProcedureFormValues[],
  breakdowns: ProcedureCostBreakdown[],
  actuals: ProcedureActualPerformance[],
): ProcedureInsight[] => {
  const actualMap = new Map<string, ProcedureActualPerformance>();
  actuals.forEach(entry => {
    if (entry && entry.procedureId) {
      actualMap.set(entry.procedureId, entry);
    }
  });

  return procedures
    .map(procedure => {
      const breakdown = breakdowns.find(item => item.procedureId === procedure.id);
      if (!breakdown) {
        return null;
      }
      const actual = actualMap.get(procedure.id);
      const performed = actual?.performed ?? 0;
      const marketingSpend = actual?.marketingSpend ?? null;
      const revenue = performed * procedure.price;
      const profit = performed * breakdown.margin;
      const staffMinutes = procedure.staffAssignments.reduce((acc, assignment) => acc + assignment.minutes, 0);
      const treatmentMinutes =
        typeof procedure.treatmentMinutes === 'number' && Number.isFinite(procedure.treatmentMinutes)
          ? procedure.treatmentMinutes
          : procedure.totalMinutes;
      const totalTreatmentMinutes = treatmentMinutes * performed;
      const totalLaborCost = breakdown.directLaborCost * performed;
      const totalConsumableCost = breakdown.consumableCost * performed;
      const totalFixedCostAllocated = breakdown.fixedCostAllocated * performed;
      const breakevenGap =
        breakdown.breakevenUnits === null
          ? null
          : Math.max(0, Math.ceil(breakdown.breakevenUnits) - Math.max(0, Math.floor(performed)));
      const roas =
        marketingSpend && marketingSpend > 0 ? revenue / marketingSpend : null;
      const cac =
        marketingSpend && marketingSpend > 0 && performed > 0 ? marketingSpend / performed : null;

      const staffAssignments = procedure.staffAssignments.map(assignment => ({
        staffId: assignment.staffId,
        minutesPerUnit: assignment.minutes,
        totalMinutes: assignment.minutes * performed,
      }));

      return {
        id: procedure.id,
        name: procedure.name,
        category: deriveCategoryFromName(procedure.name),
        price: procedure.price,
        totalCost: breakdown.totalCost,
        directLaborCost: breakdown.directLaborCost,
        consumableCost: breakdown.consumableCost,
        fixedCostAllocated: breakdown.fixedCostAllocated,
        unitMargin: breakdown.margin,
        marginRate: breakdown.marginRate,
        breakevenUnits: breakdown.breakevenUnits,
        breakevenGap,
        performed,
        revenue,
        profit,
        marketingSpend,
        roas,
        cac,
        demandShare: 0,
        profitShare: 0,
        staffMinutes,
        totalStaffMinutes: staffMinutes * performed,
        totalLaborCost,
        totalConsumableCost,
        totalFixedCostAllocated,
        treatmentMinutes,
        totalTreatmentMinutes,
        staffAssignments,
      } as ProcedureInsight;
    })
    .filter((item): item is ProcedureInsight => Boolean(item));
};

const buildCategoryInsights = (procedures: ProcedureInsight[]): CategoryInsight[] => {
  const categories = new Map<string, ProcedureInsight[]>();
  procedures.forEach(proc => {
    const key = proc.category || '기타';
    if (!categories.has(key)) {
      categories.set(key, []);
    }
    categories.get(key)!.push(proc);
  });

  return Array.from(categories.entries()).map(([name, items]) => {
    const totalPerformed = items.reduce((acc, item) => acc + item.performed, 0);
    const totalRevenue = items.reduce((acc, item) => acc + item.revenue, 0);
    const avgMarginRate = items.length
      ? items.reduce((acc, item) => acc + item.marginRate, 0) / items.length
      : 0;
    const sortedByMargin = [...items].sort((a, b) => b.marginRate - a.marginRate);
    const leader = sortedByMargin[0] ?? null;
    const laggard = sortedByMargin[sortedByMargin.length - 1] ?? null;

    return {
      name,
      totalPerformed,
      totalRevenue,
      avgMarginRate,
      leader,
      laggard,
    };
  });
};

const buildStaffUtilization = (
  staff: StaffProfile[],
  procedures: ProcedureInsight[],
): StaffUtilizationInsight[] => {
  const requirement = new Map<string, number>();
  procedures.forEach(proc => {
    if (proc.performed <= 0) {
      return;
    }
    proc.staffAssignments.forEach(assignment => {
      requirement.set(
        assignment.staffId,
        (requirement.get(assignment.staffId) ?? 0) + assignment.totalMinutes,
      );
    });
  });

  return staff
    .map(profile => {
      const available =
        profile.workPattern?.derivedMonthlyMinutes ??
        profile.workDaysPerMonth * profile.workHoursPerDay * MINUTES_IN_HOUR;
      const required = requirement.get(profile.id) ?? 0;
      const utilization =
        available > 0 ? required / available : null;
      return {
        staffId: profile.id,
        name: profile.name,
        role: profile.role,
        availableMinutes: available,
        requiredMinutes: required,
        utilization,
      };
    })
    .sort((a, b) => {
      const ua = a.utilization ?? -1;
      const ub = b.utilization ?? -1;
      return ub - ua;
    });
};

const buildBedUtilization = (
  operational: OperationalConfig,
  procedures: ProcedureInsight[],
): BedUtilizationInsight => {
  const perBedCapacityMinutes = computeMonthlyOperationalMinutes(operational);
  const currentBeds =
    typeof operational.bedCount === 'number' && operational.bedCount > 0 ? operational.bedCount : 1;
  const totalCapacityMinutes = perBedCapacityMinutes * currentBeds;
  const requiredMinutes = procedures.reduce((acc, proc) => acc + proc.totalTreatmentMinutes, 0);
  const utilization =
    totalCapacityMinutes > 0 ? requiredMinutes / totalCapacityMinutes : null;
  const recommendedBeds =
    perBedCapacityMinutes > 0 ? Math.max(1, Math.ceil(requiredMinutes / perBedCapacityMinutes)) : null;

  const simulate = (beds: number): BedSimulationResult => {
    const safeBeds = Number.isFinite(beds) && beds > 0 ? Math.floor(beds) : 0;
    const capacityMinutes = perBedCapacityMinutes * safeBeds;
    const simulatedUtilization =
      capacityMinutes > 0 ? requiredMinutes / capacityMinutes : null;
    const additionalBedsNeeded =
      perBedCapacityMinutes > 0
        ? Math.max(0, Math.ceil(requiredMinutes / perBedCapacityMinutes) - safeBeds)
        : null;
    return {
      beds: safeBeds,
      utilization: simulatedUtilization,
      spareMinutes: capacityMinutes - requiredMinutes,
      additionalBedsNeeded,
    };
  };

  return {
    currentBeds,
    perBedCapacityMinutes,
    totalCapacityMinutes,
    requiredMinutes,
    utilization,
    recommendedBeds,
    simulate,
  };
};

export const useMarketingInsights = (state: StandaloneCostingState): MarketingInsightsResult => {
  return useMemo(() => {
    const procedures = buildProcedureInsights(state.procedures, state.breakdowns, state.procedureActuals);

    const totalRevenue = procedures.reduce((acc, item) => acc + item.revenue, 0);
    const totalProfit = procedures.reduce((acc, item) => acc + item.profit, 0);
    const totalPerformed = procedures.reduce((acc, item) => acc + item.performed, 0);
    const totalMarketingSpend = state.procedureActuals.reduce(
      (acc, item) => acc + (item.marketingSpend ?? 0),
      0,
    );
    const totalStaffMinutesActual = procedures.reduce((acc, item) => acc + item.totalStaffMinutes, 0);
    const totalLaborCostActual = procedures.reduce((acc, item) => acc + item.totalLaborCost, 0);
    const totalConsumableSpend = procedures.reduce((acc, item) => acc + item.totalConsumableCost, 0);
    const averageLaborCostPerMinute =
      totalStaffMinutesActual > 0 ? totalLaborCostActual / totalStaffMinutesActual : 0;
    const totalFixedCostAllocatedActual = procedures.reduce(
      (acc, item) => acc + item.totalFixedCostAllocated,
      0,
    );
    const averageFixedCostPerProcedure =
      totalPerformed > 0 ? totalFixedCostAllocatedActual / totalPerformed : 0;
    const averageMarginRate = procedures.length
      ? procedures.reduce((acc, item) => acc + item.marginRate, 0) / procedures.length
      : 0;
    const laborAllocation = calculateLaborCostAllocation({
      staff: state.staff,
      breakdowns: state.breakdowns,
      actuals: state.procedureActuals,
    });

    const enrichedProcedures = procedures.map(proc => ({
      ...proc,
      demandShare: totalPerformed > 0 ? proc.performed / totalPerformed : 0,
      profitShare: totalProfit > 0 ? proc.profit / totalProfit : 0,
    }));

    const topMarginProcedures = [...enrichedProcedures]
      .sort((a, b) => b.marginRate - a.marginRate)
      .slice(0, 3);

    const lowMarginProcedures = [...enrichedProcedures]
      .sort((a, b) => a.marginRate - b.marginRate)
      .slice(0, 3);

    const growthCandidates = enrichedProcedures
      .filter(proc => proc.marginRate >= averageMarginRate && (proc.breakevenGap === null || proc.breakevenGap > 0))
      .sort((a, b) => {
        const aPotential = (a.breakevenGap ?? 1) * a.unitMargin;
        const bPotential = (b.breakevenGap ?? 1) * b.unitMargin;
        return bPotential - aPotential;
      })
      .slice(0, 5);

    const pruneCandidates = enrichedProcedures
      .filter(proc => proc.marginRate < averageMarginRate * 0.9 && proc.performed < (totalPerformed / (enrichedProcedures.length || 1)))
      .sort((a, b) => a.marginRate - b.marginRate)
      .slice(0, 5);

    const categories = buildCategoryInsights(enrichedProcedures);
    const staffUtilization = buildStaffUtilization(state.staff, enrichedProcedures);
    const bedUtilization = buildBedUtilization(state.operational, enrichedProcedures);

    return {
      procedures: enrichedProcedures,
      categories,
      staffUtilization,
      bedUtilization,
      summary: {
        totalRevenue,
        totalProfit,
        totalPerformed,
        totalMarketingSpend,
        averageMarginRate,
        totalStaffMinutesActual,
        totalLaborCostActual,
        totalConsumableSpend,
        averageLaborCostPerMinute,
        totalFixedCostAllocatedActual,
        averageFixedCostPerProcedure,
        totalStaffPayroll: laborAllocation.totalPayroll,
        allocatedLaborCost: laborAllocation.allocatedLaborCost,
        unallocatedLaborCost: laborAllocation.unallocatedLaborCost,
        laborAllocationRate: laborAllocation.allocationRate,
        topMarginProcedures,
        lowMarginProcedures,
        growthCandidates,
        pruneCandidates,
      },
    };
  }, [state]);
};
