import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStandaloneCosting } from '../state/StandaloneCostingProvider';
import { useMarketingInsights } from '../hooks/useMarketingInsights';
import { formatKrw, formatPercentage } from '../../../utils/formatters';
import StatCard from './StatCard';
import PhaseSaveControls from './PhaseSaveControls';

type MarketingTabId = 'overview' | 'goals' | 'operations' | 'bundles' | 'performance';

const MARKETING_TABS: Array<{ id: MarketingTabId; label: string }> = [
  { id: 'overview', label: '개요' },
  { id: 'goals', label: '목표·마케팅' },
  { id: 'operations', label: '운영·인력' },
  { id: 'bundles', label: '조합·신규' },
  { id: 'performance', label: '실적 분석' },
];

const formatCount = (value: number, fractions = 0) =>
  Number(value).toLocaleString('ko-KR', { maximumFractionDigits: fractions, minimumFractionDigits: fractions });

const clampNonNegative = (value: number) => (Number.isFinite(value) && value >= 0 ? value : 0);

const parsePerformedInput = (value?: string): number => {
  if (!value) {
    return 0;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }
  return numeric;
};

interface MarketingValueSnapshot {
  editorPerformed: string;
  editorMarketing: string;
  hadActual: boolean;
  actualPerformed: number;
  actualMarketing: number | null;
}

const parseCurrencyInput = (value: string): number => {
  if (!value) {
    return 0;
  }
  const digits = value.replace(/[^\d]/g, '');
  if (!digits) {
    return 0;
  }
  const numeric = Number(digits);
  return Number.isFinite(numeric) ? numeric : 0;
};

const formatCurrencyValue = (value?: number | null): string => {
  if (value === null || value === undefined || !Number.isFinite(value) || value === 0) {
    return '';
  }
  return value.toLocaleString('ko-KR');
};

const formatCurrencyString = (value: string): string => {
  if (!value) {
    return '';
  }
  const digitsOnly = value.replace(/[^\d]/g, '');
  if (!digitsOnly) {
    return '';
  }
  const numeric = Number(digitsOnly);
  if (!Number.isFinite(numeric)) {
    return '';
  }
  return numeric.toLocaleString('ko-KR');
};

const MarketingInsightsSection: React.FC = () => {
  const { state, upsertProcedureActual, removeProcedureActual, setMarketingSettings } = useStandaloneCosting();
  const insights = useMarketingInsights(state);
  const [activeTab, setActiveTab] = useState<MarketingTabId>('overview');

  const operationalMarketingBudget = useMemo(
    () =>
      state.fixedCosts
        .filter(item => item.costGroup === 'marketing')
        .reduce((acc, item) => acc + (Number.isFinite(item.monthlyAmount) ? item.monthlyAmount : 0), 0),
    [state.fixedCosts],
  );

  const manualTargetRevenue = state.marketingSettings?.targetRevenue ?? null;
  const computedTargetRevenue = useMemo(() => {
    if (manualTargetRevenue != null) {
      return manualTargetRevenue;
    }
    if (insights.summary.totalRevenue > 0) {
      return Math.round(insights.summary.totalRevenue * 1.1);
    }
    return 0;
  }, [manualTargetRevenue, insights.summary.totalRevenue]);

  const [targetRevenue, setTargetRevenue] = useState<number>(computedTargetRevenue);
  const [targetRevenueInput, setTargetRevenueInput] = useState<string>(() => formatCurrencyValue(computedTargetRevenue));

  const manualMarketingBudget = state.marketingSettings?.manualMarketingBudget ?? null;
  const computedMarketingBudget = useMemo(() => {
    if (manualMarketingBudget != null) {
      return manualMarketingBudget;
    }
    if (operationalMarketingBudget > 0) {
      return operationalMarketingBudget;
    }
    if (insights.summary.totalMarketingSpend > 0) {
      return Math.round(insights.summary.totalMarketingSpend);
    }
    return 0;
  }, [manualMarketingBudget, operationalMarketingBudget, insights.summary.totalMarketingSpend]);

  const [marketingBudget, setMarketingBudget] = useState<number>(computedMarketingBudget);
  const [marketingBudgetInput, setMarketingBudgetInput] = useState<string>(() => formatCurrencyValue(computedMarketingBudget));
  const hasManualTargetRevenue = manualTargetRevenue != null;
  const [simulatedBeds, setSimulatedBeds] = useState<number>(state.operational.bedCount ?? 1);
  const [costReduction, setCostReduction] = useState<number>(0);
  const clampBudgetScenario = useCallback((value: number): number => {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.min(200, Math.max(-100, Math.round(value)));
  }, []);

  const clampCostReduction = useCallback((value: number): number => {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.min(30, Math.max(0, Math.round(value)));
  }, []);

  const handleBudgetScenarioUpdate = useCallback(
    (nextValue: number) => {
      setBudgetScenarioPercent(clampBudgetScenario(nextValue));
    },
    [clampBudgetScenario],
  );

  const handleCostReductionUpdate = useCallback(
    (nextValue: number) => {
      setCostReduction(clampCostReduction(nextValue));
    },
    [clampCostReduction],
  );
  const [budgetScenarioPercent, setBudgetScenarioPercent] = useState<number>(0);

  const initialEditorValues = useMemo(() => {
    const map: Record<string, { performed: string; marketingSpend: string }> = {};
    state.procedures.forEach(procedure => {
      const actual = state.procedureActuals.find(entry => entry.procedureId === procedure.id);
      map[procedure.id] = {
        performed: actual && actual.performed > 0 ? String(actual.performed) : '',
        marketingSpend: formatCurrencyValue(actual?.marketingSpend ?? null),
      };
    });
    return map;
  }, [state.procedures, state.procedureActuals]);

  const [editorValues, setEditorValues] = useState<Record<string, { performed: string; marketingSpend: string }>>(
    initialEditorValues,
  );
  const [isUniformMarketing, setIsUniformMarketing] = useState<boolean>(false);
  const previousMarketingSnapshotRef = useRef<Record<string, MarketingValueSnapshot> | null>(null);

  const [bundlePrimary, setBundlePrimary] = useState<string>(() => state.procedures[0]?.id ?? '');
  const [bundleSecondary, setBundleSecondary] = useState<string>(() => state.procedures[1]?.id ?? '');
  const [bundleDiscount, setBundleDiscount] = useState<number>(10);

  const [newProcedureInputs, setNewProcedureInputs] = useState<{
    name: string;
    price: string;
    consumableCost: string;
    laborMinutes: string;
    treatmentMinutes: string;
    marketingSpend: string;
  }>({
    name: '',
    price: '',
    consumableCost: '',
    laborMinutes: '',
    treatmentMinutes: '',
    marketingSpend: '',
  });

  useEffect(() => {
    setEditorValues(initialEditorValues);
  }, [initialEditorValues]);

  useEffect(() => {
    setSimulatedBeds(state.operational.bedCount ?? 1);
  }, [state.operational.bedCount]);

  useEffect(() => {
    setTargetRevenue(computedTargetRevenue);
    setTargetRevenueInput(formatCurrencyValue(computedTargetRevenue));
  }, [computedTargetRevenue]);

  useEffect(() => {
    setMarketingBudget(computedMarketingBudget);
    setMarketingBudgetInput(formatCurrencyValue(computedMarketingBudget));
  }, [computedMarketingBudget]);

  useEffect(() => {
    if (state.procedures.length === 0) {
      setBundlePrimary('');
      setBundleSecondary('');
      return;
    }
    if (!state.procedures.find(item => item.id === bundlePrimary)) {
      setBundlePrimary(state.procedures[0].id);
    }
    if (!state.procedures.find(item => item.id === bundleSecondary) || bundleSecondary === bundlePrimary) {
      const fallback = state.procedures.find(item => item.id !== bundlePrimary);
      setBundleSecondary(fallback?.id ?? '');
    }
  }, [state.procedures, bundlePrimary, bundleSecondary]);

  const marketingAllocations = useMemo(() => {
    const additionalRevenue = targetRevenue - insights.summary.totalRevenue;
    const averageDemandShare = insights.procedures.length > 0 ? 1 / insights.procedures.length : 0;

    const scoring = insights.procedures.map(procedure => {
      const demandBoost = procedure.demandShare < averageDemandShare ? 1.25 : 1;
      const profitabilityBoost = procedure.marginRate >= insights.summary.averageMarginRate ? 1.2 : 1;
      const breakevenBoost = procedure.breakevenGap ? 1 + Math.min(procedure.breakevenGap, 10) / 10 : 1;
      const score = (procedure.marginRate + 1) * demandBoost * profitabilityBoost * breakevenBoost;
      return {
        procedure,
        score,
      };
    });

    const totalScore = scoring.reduce((acc, item) => acc + item.score, 0);
    return scoring.map(item => {
      const weight = totalScore > 0 ? item.score / totalScore : 1 / Math.max(1, scoring.length);
      const budget = marketingBudget * weight;
      const revenueContribution = additionalRevenue * weight;
      const baselineUnits = clampNonNegative(item.procedure.performed);
      const rawDeltaUnits = item.procedure.price > 0 ? revenueContribution / item.procedure.price : 0;
      const rawTargetUnits = baselineUnits + rawDeltaUnits;
      const targetUnits = rawTargetUnits < 0 ? 0 : rawTargetUnits;
      const deltaUnits = targetUnits - baselineUnits;
      return {
        procedure: item.procedure,
        budget,
        additionalRevenue: revenueContribution,
        deltaUnits,
        targetUnits,
        projectedMargin: deltaUnits * item.procedure.unitMargin,
      };
    });
  }, [insights.procedures, insights.summary.totalRevenue, insights.summary.averageMarginRate, marketingBudget, targetRevenue]);

  const bedSimulation = useMemo(() => insights.bedUtilization.simulate(simulatedBeds), [insights.bedUtilization, simulatedBeds]);

  const costReductionImpact = useMemo(() => {
    const savings = insights.summary.totalConsumableSpend * (costReduction / 100);
    return {
      savings,
      projectedProfit: insights.summary.totalProfit + savings,
    };
  }, [insights.summary.totalConsumableSpend, insights.summary.totalProfit, costReduction]);

  const marketingEfficiency =
    insights.summary.totalMarketingSpend > 0
      ? insights.summary.totalRevenue / insights.summary.totalMarketingSpend
      : null;

  const baselineRevenue = hasManualTargetRevenue && targetRevenue > 0 ? targetRevenue : insights.summary.totalRevenue;
  const baselineProfit =
    insights.summary.totalRevenue > 0
      ? insights.summary.totalProfit
      : baselineRevenue > 0 && insights.summary.totalRevenue === 0
        ? baselineRevenue * 0.3
        : insights.summary.totalProfit;

  const baselineBudgetForSimulation = marketingBudget > 0 ? marketingBudget : operationalMarketingBudget;

  const globalMarketingScenario = useMemo(() => {
    if (baselineBudgetForSimulation <= 0) {
      return null;
    }
    const adjustment = budgetScenarioPercent / 100;
    const adjustedBudget = baselineBudgetForSimulation * (1 + adjustment);
    const fallbackEfficiency =
      baselineRevenue > 0 && baselineBudgetForSimulation > 0
        ? baselineRevenue / baselineBudgetForSimulation
        : null;
    const effectiveEfficiency = marketingEfficiency ?? fallbackEfficiency;
    const projectedRevenueFromEfficiency =
      effectiveEfficiency != null ? adjustedBudget * effectiveEfficiency : null;
    const projectedRevenue = projectedRevenueFromEfficiency ?? baselineRevenue;

    const profitRatio =
      insights.summary.totalRevenue > 0 ? insights.summary.totalProfit / insights.summary.totalRevenue : null;
    const projectedProfit =
      profitRatio != null ? projectedRevenue * profitRatio : projectedRevenue * 0.3;

    const deltaRevenue = projectedRevenue - baselineRevenue;
    const deltaProfit = projectedProfit - baselineProfit;

    return {
      adjustedBudget,
      projectedRevenue,
      projectedProfit,
      deltaRevenue,
      deltaProfit,
    };
  }, [
    baselineBudgetForSimulation,
    budgetScenarioPercent,
    marketingEfficiency,
    baselineRevenue,
    baselineProfit,
    insights.summary.totalProfit,
    insights.summary.totalRevenue,
  ]);

  const selectedPrimary = insights.procedures.find(proc => proc.id === bundlePrimary) ?? null;
  const selectedSecondary = insights.procedures.find(proc => proc.id === bundleSecondary) ?? null;

  const bundleAnalysis = useMemo(() => {
    if (!selectedPrimary || !selectedSecondary) {
      return null;
    }
    const combinedPrice = selectedPrimary.price + selectedSecondary.price;
    const combinedCost = selectedPrimary.totalCost + selectedSecondary.totalCost;
    const discountRate = clampNonNegative(bundleDiscount) / 100;
    const discountedPrice = combinedPrice * (1 - discountRate);
    const combinedMargin = discountedPrice - combinedCost;
    const individualMarginSum = selectedPrimary.unitMargin + selectedSecondary.unitMargin;
    const combinedMarginRate = discountedPrice > 0 ? combinedMargin / discountedPrice : 0;

    return {
      combinedPrice,
      combinedCost,
      discountedPrice,
      combinedMargin,
      individualMarginSum,
      combinedMarginRate,
      discountRate,
    };
  }, [selectedPrimary, selectedSecondary, bundleDiscount]);

  const newProcedureSimulation = useMemo(() => {
    const price = parseCurrencyInput(newProcedureInputs.price);
    const consumableCost = parseCurrencyInput(newProcedureInputs.consumableCost);
    const laborMinutes = Number(newProcedureInputs.laborMinutes);
    const treatmentMinutes = Number(newProcedureInputs.treatmentMinutes);
    const marketingSpendValue = parseCurrencyInput(newProcedureInputs.marketingSpend);

    if (!Number.isFinite(price) || price <= 0) {
      return null;
    }

    const laborCost =
      laborMinutes > 0 ? laborMinutes * insights.summary.averageLaborCostPerMinute : 0;
    const fixedCost = insights.summary.averageFixedCostPerProcedure;
    const totalCost = (Number.isFinite(consumableCost) ? consumableCost : 0) + laborCost + fixedCost;
    const margin = price - totalCost;
    const marginRate = price > 0 ? margin / price : 0;
    const breakevenUnits =
      margin > 0 && Number.isFinite(marketingSpendValue) && marketingSpendValue > 0 ? marketingSpendValue / margin : null;
    const roas = Number.isFinite(marketingSpendValue) && marketingSpendValue > 0 ? price / marketingSpendValue : null;

    return {
      totalCost,
      laborCost,
      fixedCost,
      margin,
      marginRate,
      breakevenUnits,
      roas,
      treatmentMinutes,
    };
  }, [newProcedureInputs, insights.summary.averageLaborCostPerMinute, insights.summary.averageFixedCostPerProcedure]);

  const handleEditorChange = (procedureId: string, field: 'performed' | 'marketingSpend', value: string) => {
    setEditorValues(prev => {
      const previous = prev[procedureId] ?? { performed: '', marketingSpend: '' };
      if (field === 'performed') {
        return {
          ...prev,
          [procedureId]: {
            performed: value,
            marketingSpend: previous.marketingSpend,
          },
        };
      }
      const formatted = formatCurrencyString(value);
      return {
        ...prev,
        [procedureId]: {
          performed: previous.performed,
          marketingSpend: formatted,
        },
      };
    });
  };

  const applyUniformMarketing = useCallback((): boolean => {
    if (operationalMarketingBudget <= 0 || state.procedures.length === 0) {
      return false;
    }

    const baseShare = Math.floor(operationalMarketingBudget / state.procedures.length);
    let remainder = operationalMarketingBudget - baseShare * state.procedures.length;

    const snapshot: Record<string, MarketingValueSnapshot> = {};
    const updates: Array<{ procedureId: string; performed: number; marketingSpend: number }> = [];

    setEditorValues(prev => {
      const next = { ...prev };
      state.procedures.forEach(procedure => {
        const existing = state.procedureActuals.find(entry => entry.procedureId === procedure.id);
        const previousEditor = prev[procedure.id] ?? {
          performed: existing && existing.performed > 0 ? String(existing.performed) : '',
          marketingSpend:
            existing && existing.marketingSpend != null
              ? existing.marketingSpend === 0
                ? '0'
                : existing.marketingSpend.toLocaleString('ko-KR')
              : '',
        };

        snapshot[procedure.id] = {
          editorPerformed: previousEditor.performed,
          editorMarketing: previousEditor.marketingSpend,
          hadActual: Boolean(existing),
          actualPerformed: existing?.performed ?? 0,
          actualMarketing: existing?.marketingSpend ?? null,
        };

        let allocation = baseShare;
        if (remainder > 0) {
          allocation += 1;
          remainder -= 1;
        }

        next[procedure.id] = {
          performed: previousEditor.performed,
          marketingSpend: allocation > 0 ? allocation.toLocaleString('ko-KR') : '0',
        };

        const performedNumeric = existing?.performed ?? parsePerformedInput(previousEditor.performed);
        updates.push({
          procedureId: procedure.id,
          performed: performedNumeric,
          marketingSpend: allocation,
        });
      });
      return next;
    });

    previousMarketingSnapshotRef.current = snapshot;
    updates.forEach(entry => {
      upsertProcedureActual({
        procedureId: entry.procedureId,
        performed: entry.performed,
        marketingSpend: entry.marketingSpend,
      });
    });
    return true;
  }, [operationalMarketingBudget, state.procedures, state.procedureActuals, upsertProcedureActual]);

  const revertUniformMarketing = useCallback(() => {
    const snapshot = previousMarketingSnapshotRef.current;
    if (!snapshot) {
      return;
    }
    previousMarketingSnapshotRef.current = null;

    const restores: Array<{ procedureId: string; performed: number; marketingSpend: number | null }> = [];
    const removals: string[] = [];

    setEditorValues(prev => {
      const next = { ...prev };
      state.procedures.forEach(procedure => {
        const saved = snapshot[procedure.id];
        if (!saved) {
          return;
        }
        next[procedure.id] = {
          performed: saved.editorPerformed,
          marketingSpend: saved.editorMarketing,
        };
        if (saved.hadActual) {
          restores.push({
            procedureId: procedure.id,
            performed: saved.actualPerformed,
            marketingSpend: saved.actualMarketing ?? null,
          });
        } else {
          removals.push(procedure.id);
        }
      });
      return next;
    });

    restores.forEach(entry => {
      upsertProcedureActual({
        procedureId: entry.procedureId,
        performed: entry.performed,
        marketingSpend: entry.marketingSpend ?? null,
      });
    });
    removals.forEach(id => removeProcedureActual(id));
  }, [removeProcedureActual, state.procedures, upsertProcedureActual]);

  const handleUniformMarketingToggle = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const checked = event.target.checked;
      if (checked) {
        const applied = applyUniformMarketing();
        if (applied) {
          setIsUniformMarketing(true);
        } else {
          setIsUniformMarketing(false);
        }
      } else {
        revertUniformMarketing();
        setIsUniformMarketing(false);
      }
    },
    [applyUniformMarketing, revertUniformMarketing],
  );

  useEffect(() => {
    if (isUniformMarketing && (operationalMarketingBudget <= 0 || state.procedures.length === 0)) {
      revertUniformMarketing();
      setIsUniformMarketing(false);
    }
  }, [isUniformMarketing, operationalMarketingBudget, state.procedures.length, revertUniformMarketing]);

  const handleEditorBlur = (procedureId: string) => {
    const current = editorValues[procedureId];
    if (!current) {
      return;
    }
    const parsedPerformed = Number(current.performed);
    const performed = Number.isFinite(parsedPerformed) && parsedPerformed >= 0 ? parsedPerformed : 0;
    const hasMarketingValue = current.marketingSpend.trim().length > 0;
    const marketingNumeric = parseCurrencyInput(current.marketingSpend);
    const marketingSpend = hasMarketingValue ? marketingNumeric : null;

    if (performed === 0 && (marketingSpend === null || marketingSpend === 0)) {
      removeProcedureActual(procedureId);
      setEditorValues(prev => ({
        ...prev,
        [procedureId]: {
          performed: '',
          marketingSpend: '',
        },
      }));
      return;
    }

    upsertProcedureActual({
      procedureId,
      performed,
      marketingSpend,
    });
    const formattedMarketing =
      marketingSpend === null ? '' : marketingSpend === 0 ? '0' : formatCurrencyValue(marketingSpend);
    const performedValue =
      performed === 0 ? (current.performed.trim().length > 0 ? '0' : '') : performed.toString();
    setEditorValues(prev => ({
      ...prev,
      [procedureId]: {
        performed: performedValue,
        marketingSpend: formattedMarketing,
      },
    }));
  };

  const handleClearActual = (procedureId: string) => {
    removeProcedureActual(procedureId);
    setEditorValues(prev => ({
      ...prev,
      [procedureId]: {
        performed: '',
        marketingSpend: '',
      },
    }));
  };

  const handleResetMarketingBudget = () => {
    let nextBudget = 0;
    if (operationalMarketingBudget > 0) {
      nextBudget = operationalMarketingBudget;
    } else if (insights.summary.totalMarketingSpend > 0) {
      nextBudget = Math.round(insights.summary.totalMarketingSpend);
    }
    setMarketingBudget(nextBudget);
    setMarketingBudgetInput(formatCurrencyValue(nextBudget));
    setMarketingSettings({ manualMarketingBudget: null });
  };

  const handleTargetRevenueChange = (raw: string) => {
    const digitsOnly = raw.replace(/[^\d]/g, '');
    if (!digitsOnly) {
      setTargetRevenue(0);
      setTargetRevenueInput('');
      setMarketingSettings({ targetRevenue: null });
      return;
    }
    const numeric = Number(digitsOnly);
    const formatted = Number(numeric).toLocaleString('ko-KR');
    setTargetRevenue(numeric);
    setTargetRevenueInput(formatted);
    setMarketingSettings({ targetRevenue: numeric });
  };

  const handleMarketingBudgetChange = (raw: string) => {
    const digitsOnly = raw.replace(/[^\d]/g, '');
    if (!digitsOnly) {
      setMarketingBudget(0);
      setMarketingBudgetInput('');
      setMarketingSettings({ manualMarketingBudget: null });
      return;
    }
    const numeric = Number(digitsOnly);
    const formatted = Number(numeric).toLocaleString('ko-KR');
    setMarketingBudget(numeric);
    setMarketingBudgetInput(formatted);
    setMarketingSettings({ manualMarketingBudget: numeric });
  };

  const overviewContent = (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="월 실제 매출"
          value={formatKrw(insights.summary.totalRevenue)}
          description="실적 입력 건수를 기준으로 계산된 매출입니다."
        />
        <StatCard
          title="월 실제 마진"
          value={formatKrw(insights.summary.totalProfit)}
          description="실적 기준으로 산출된 총 마진입니다."
          variant="info"
        />
        <StatCard
          title="평균 마진율"
          value={insights.summary.averageMarginRate ? formatPercentage(insights.summary.averageMarginRate) : '-'}
          description="등록된 시술의 단위 마진율 평균입니다."
          variant="info"
        />
        <StatCard
          title="총 마케팅 비용"
          value={formatKrw(insights.summary.totalMarketingSpend)}
          description="시술별 입력한 마케팅비의 합계입니다."
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-5">
          <h3 className="text-sm font-semibold text-blue-900">집중 투자 추천 시술</h3>
          <p className="mt-1 text-xs text-blue-700">
            마진율이 높고 추가 성장 여지가 있는 시술입니다. 마케팅 예산과 상담 리소스를 우선 배분하세요.
          </p>
          <ul className="mt-3 space-y-2 text-sm text-blue-900">
            {insights.summary.growthCandidates.length === 0 && (
              <li className="rounded-md bg-white/50 p-3 text-blue-600">추천할 시술이 없습니다.</li>
            )}
            {insights.summary.growthCandidates.map(candidate => (
              <li key={candidate.id} className="rounded-md bg-white/70 p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{candidate.name}</span>
                  <span className="text-xs text-blue-600">
                    마진율 {formatPercentage(candidate.marginRate)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-blue-700">
                  손익분기까지 {candidate.breakevenGap != null ? `${formatCount(candidate.breakevenGap)}건 남음` : '데이터 부족'}
                  · 현 실행 {formatCount(candidate.performed)}건 · 단위 마진 {formatKrw(candidate.unitMargin)}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-rose-100 bg-rose-50 p-5">
          <h3 className="text-sm font-semibold text-rose-900">축소 검토 시술</h3>
          <p className="mt-1 text-xs text-rose-700">
            마진율이 낮고 수요가 약한 시술입니다. 프로모션 조정이나 리포지셔닝을 검토하세요.
          </p>
          <ul className="mt-3 space-y-2 text-sm text-rose-900">
            {insights.summary.pruneCandidates.length === 0 && (
              <li className="rounded-md bg-white/50 p-3 text-rose-600">축소를 권장할 시술이 없습니다.</li>
            )}
            {insights.summary.pruneCandidates.map(candidate => (
              <li key={candidate.id} className="rounded-md bg-white/70 p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{candidate.name}</span>
                  <span className="text-xs text-rose-600">
                    마진율 {formatPercentage(candidate.marginRate)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-rose-700">
                  월 실적 {formatCount(candidate.performed)}건 · 단위 마진 {formatKrw(candidate.unitMargin)} · 카테고리 {candidate.category}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900">시술 카테고리 스냅샷</h3>
        <p className="mt-1 text-xs text-gray-500">카테고리별 실적과 마진율을 비교해 포트폴리오 균형을 점검하세요.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">카테고리</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">등록 건수</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">매출</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">평균 마진율</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">대표 시술</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {insights.categories.map(category => (
                <tr key={category.name} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{category.name}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatCount(category.totalPerformed)}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatKrw(category.totalRevenue)}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatPercentage(category.avgMarginRate)}</td>
                  <td className="px-4 py-2 text-left text-gray-700">
                    <div className="text-xs">
                      <span className="font-semibold text-gray-900">
                        {category.leader ? `${category.leader.name} (↑)` : '-'}
                      </span>
                      {category.laggard && (
                        <span className="ml-3 text-gray-500">
                          • 조정 필요: {category.laggard.name}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    );

  const goalsContent = (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm text-gray-700">
          <span className="font-semibold text-gray-900">월 매출 목표 (원)</span>
          <input
            type="text"
            inputMode="numeric"
            value={targetRevenueInput}
            onChange={event => handleTargetRevenueChange(event.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-right text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="예: 400,000,000"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-gray-700">
          <span className="flex items-center gap-2 font-semibold text-gray-900">
            월 마케팅 예산 (원)
            <button
              type="button"
              onClick={handleResetMarketingBudget}
              className="rounded-md border border-gray-300 px-2 py-0.5 text-2xs font-medium text-gray-600 transition-colors hover:border-blue-300 hover:text-blue-600"
            >
              운영 세팅 적용
            </button>
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={marketingBudgetInput}
            onChange={event => handleMarketingBudgetChange(event.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-right text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="예: 10,000,000"
          />
        </label>
      </div>

      <div className="rounded-lg border border-gray-200">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">시술별 추천 예산 배분</h3>
          <p className="mt-1 text-xs text-gray-500">
            성장성과 마진율을 기준으로 산출된 가중치입니다. 전략 회의 시 참조 가이드로 활용하세요.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-white">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">시술명</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">추천 예산</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">목표 건수</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">필요 증감</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">추가 마진 예상</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {marketingAllocations.map(item => (
                <tr key={item.procedure.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{item.procedure.name}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatKrw(item.budget)}</td>
                  <td className="px-4 py-2 text-right text-gray-700">
                    {item.targetUnits > 0 ? `${formatCount(item.targetUnits, 1)}건` : '0건'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {item.deltaUnits === 0 ? (
                      <span className="text-gray-500">변화 없음</span>
                    ) : (
                      <span className={`font-semibold ${item.deltaUnits > 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                        {item.deltaUnits > 0 ? '+' : ''}
                        {formatCount(item.deltaUnits, 1)}건
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-700">
                    {item.projectedMargin > 0 ? formatKrw(item.projectedMargin) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600">
          <p>
            추천 배분은 자동 산출된 참고값입니다. 실제 캠페인 운영 시 전환율, 고객군, 시즌ality를 함께 검토해 조정하세요.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">전체 마케팅 예산 증감 시뮬레이션</h3>
          <p className="mt-1 text-xs text-gray-500">
            현재 예산 대비 증감 비율을 조정하면 예상 매출 및 마진 변화를 추정해 볼 수 있습니다.
          </p>
        </div>
        <div className="px-4 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <label className="flex items-center gap-3 text-sm text-gray-700">
              <span>예산 증감 비율</span>
              <input
                type="range"
                min={-100}
                max={200}
                step={10}
                value={budgetScenarioPercent}
                onChange={event => handleBudgetScenarioUpdate(Number(event.target.value))}
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  className="w-16 rounded border border-blue-200 px-2 py-1 text-right text-sm text-blue-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={budgetScenarioPercent}
                  onChange={event => {
                    const { value } = event.target;
                    if (value === '') {
                      handleBudgetScenarioUpdate(0);
                      return;
                    }
                    const parsed = Number(value);
                    if (Number.isNaN(parsed)) {
                      return;
                    }
                    handleBudgetScenarioUpdate(parsed);
                  }}
                />
                <span className="text-sm font-semibold text-blue-700">%</span>
              </div>
            </label>
            <div className="text-xs text-gray-500">
              기준 예산 {formatKrw(baselineBudgetForSimulation)} · 기준 매출 {formatKrw(baselineRevenue)}
            </div>
          </div>

          {globalMarketingScenario ? (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">조정된 예산</p>
                <p className="mt-1 text-lg font-semibold">{formatKrw(globalMarketingScenario.adjustedBudget)}</p>
                <p className="mt-1 text-xs text-blue-700">
                  증감 {globalMarketingScenario.deltaRevenue >= 0 ? '+' : ''}
                  {formatKrw(globalMarketingScenario.adjustedBudget - baselineBudgetForSimulation)}
                </p>
              </div>
              <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-900">
                <p className="text-xs font-semibold uppercase tracking-wider text-green-600">예상 매출</p>
                <p className="mt-1 text-lg font-semibold">{formatKrw(globalMarketingScenario.projectedRevenue)}</p>
                <p className="mt-1 text-xs text-green-700">
                  변화 {globalMarketingScenario.deltaRevenue >= 0 ? '+' : ''}
                  {formatKrw(globalMarketingScenario.deltaRevenue)}
                </p>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">예상 마진</p>
                <p className="mt-1 text-lg font-semibold">{formatKrw(globalMarketingScenario.projectedProfit)}</p>
                <p className="mt-1 text-xs text-amber-700">
                  변화 {globalMarketingScenario.deltaProfit >= 0 ? '+' : ''}
                  {formatKrw(globalMarketingScenario.deltaProfit)}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-500">
              운영 세팅이나 실적에서 마케팅 예산이 등록되어야 시뮬레이션을 진행할 수 있습니다.
            </p>
          )}
          <p className="mt-4 text-xs text-gray-500">
            * 예상치는 최근 실적의 매출/마케팅비 효율을 기반으로 산출되었습니다. 채널별 성과나 시즌ality에 따라 실제 결과는 달라질 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );

  const operationsContent = (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900">인력 가동률</h3>
        <p className="mt-1 text-xs text-gray-500">각 스태프의 월 가용 시간 대비 실제 소요 시간을 비교합니다.</p>
        <div className="mt-4 space-y-3">
          {insights.staffUtilization.map(staff => (
            <div key={staff.staffId} className="rounded-md border border-gray-100 p-3 shadow-sm">
              <div className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-semibold text-gray-900">
                    {staff.name}
                    <span className="ml-2 text-xs text-gray-500">{staff.role}</span>
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    필요 {formatCount(staff.requiredMinutes)}분 / 가용 {formatCount(staff.availableMinutes)}분
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold ${
                    (staff.utilization ?? 0) > 1 ? 'text-red-600' : (staff.utilization ?? 0) > 0.75 ? 'text-amber-600' : 'text-green-600'
                  }`}
                >
                  가동률 {staff.utilization !== null ? formatPercentage(staff.utilization * 100) : '-'}
                </span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
                <div
                  className={`h-2 rounded-full ${(staff.utilization ?? 0) > 1 ? 'bg-red-500' : (staff.utilization ?? 0) > 0.75 ? 'bg-amber-500' : 'bg-blue-500'}`}
                  style={{ width: `${Math.min(100, Math.max(0, Math.round(((staff.utilization ?? 0) * 100))))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">베드 수 시뮬레이션</h3>
            <p className="mt-1 text-xs text-gray-500">
              현재 베드 {insights.bedUtilization.currentBeds}대 기준 가동률은{' '}
              {insights.bedUtilization.utilization !== null ? formatPercentage(insights.bedUtilization.utilization * 100) : '-'} 입니다.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <label className="text-gray-700">베드 수 조정</label>
            <input
              type="number"
              min={1}
              value={simulatedBeds}
              onChange={event => setSimulatedBeds(Math.max(1, Math.floor(Number(event.target.value) || 1)))}
              className="w-20 rounded-md border border-gray-300 px-3 py-1 text-right text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">시뮬레이션 가동률</p>
            <p className="mt-1 text-lg font-semibold">
              {bedSimulation.utilization !== null ? formatPercentage(bedSimulation.utilization * 100) : '-'}
            </p>
            <p className="mt-1 text-xs text-blue-700">
              여유 시간 {formatCount(bedSimulation.spareMinutes)}분 · 추가 필요 베드{' '}
              {bedSimulation.additionalBedsNeeded != null ? formatCount(bedSimulation.additionalBedsNeeded) : '-'}
            </p>
          </div>
          <div className="rounded-md border border-gray-200 p-4 text-sm text-gray-900">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">월 가용 시간</p>
            <p className="mt-1 text-lg font-semibold">{formatCount(insights.bedUtilization.totalCapacityMinutes)}분</p>
            <p className="mt-1 text-xs text-gray-600">
              1대당 {formatCount(insights.bedUtilization.perBedCapacityMinutes)}분 · 필요 {formatCount(insights.bedUtilization.requiredMinutes)}분
            </p>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">권장 베드 수</p>
            <p className="mt-1 text-lg font-semibold">
              {insights.bedUtilization.recommendedBeds != null ? `${insights.bedUtilization.recommendedBeds}대` : '-'}
            </p>
            <p className="mt-1 text-xs text-amber-700">
              성장 목표를 고려하면 베드 {simulatedBeds}대로 예상 가동률 {bedSimulation.utilization !== null ? formatPercentage(bedSimulation.utilization * 100) : '-'}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900">원가 절감 시나리오</h3>
        <p className="mt-1 text-xs text-gray-500">
          소모품 단가를 협상하거나 공용물품을 묶음 구매했을 때의 영향입니다.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-3 text-sm text-gray-700">
            <span>소모품 절감 목표</span>
            <input
              type="range"
              min={0}
              max={30}
              step={1}
              value={costReduction}
              onChange={event => handleCostReductionUpdate(Number(event.target.value))}
            />
            <div className="flex items-center gap-1">
              <input
                type="number"
                className="w-14 rounded border border-blue-200 px-2 py-1 text-right text-sm text-blue-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={costReduction}
                onChange={event => {
                  const { value } = event.target;
                  if (value === '') {
                    handleCostReductionUpdate(0);
                    return;
                  }
                  const parsed = Number(value);
                  if (Number.isNaN(parsed)) {
                    return;
                  }
                  handleCostReductionUpdate(parsed);
                }}
              />
              <span className="text-sm font-semibold text-blue-700">%</span>
            </div>
          </label>
          <div className="text-xs text-gray-500">
            현재 월 소모품 비용 {formatKrw(insights.summary.totalConsumableSpend)}
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-900">
            <p className="text-xs font-semibold uppercase tracking-wider text-green-600">절감 예상액</p>
            <p className="mt-1 text-lg font-semibold">{formatKrw(costReductionImpact.savings)}</p>
            <p className="mt-1 text-xs text-green-700">소모품 공급사와의 가격 협상, 묶음 구매 조건 재검토를 권장합니다.</p>
          </div>
          <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">절감 적용 시 예상 마진</p>
            <p className="mt-1 text-lg font-semibold">{formatKrw(costReductionImpact.projectedProfit)}</p>
            <p className="mt-1 text-xs text-blue-700">
              월 마진이 {formatKrw(costReductionImpact.projectedProfit - insights.summary.totalProfit)} 개선됩니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const bundlesContent = (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">조합 시술 시뮬레이션</h3>
            <p className="mt-1 text-xs text-gray-500">두 개 시술을 묶어 판매할 때의 가격·마진 구조를 계산합니다.</p>
          </div>
          <div className="flex gap-3">
            <select
              value={bundlePrimary}
              onChange={event => setBundlePrimary(event.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {state.procedures.map(procedure => (
                <option key={procedure.id} value={procedure.id}>
                  {procedure.name}
                </option>
              ))}
            </select>
            <select
              value={bundleSecondary}
              onChange={event => setBundleSecondary(event.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {state.procedures
                .filter(procedure => procedure.id !== bundlePrimary)
                .map(procedure => (
                  <option key={procedure.id} value={procedure.id}>
                    {procedure.name}
                  </option>
                ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <label className="flex items-center gap-3 text-sm text-gray-700">
            <span>패키지 할인율</span>
            <input
              type="range"
              min={0}
              max={40}
              step={1}
              value={bundleDiscount}
              onChange={event => setBundleDiscount(Math.max(0, Number(event.target.value)))}
            />
            <span className="w-12 text-right text-sm font-semibold text-blue-700">{bundleDiscount}%</span>
          </label>
        </div>
        {bundleAnalysis ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">패키지 제안가</p>
              <p className="mt-1 text-lg font-semibold">{formatKrw(bundleAnalysis.discountedPrice)}</p>
              <p className="mt-1 text-xs text-blue-700">
                기본 합계 {formatKrw(bundleAnalysis.combinedPrice)} → {bundleDiscount}% 할인 적용
              </p>
            </div>
            <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-900">
              <p className="text-xs font-semibold uppercase tracking-wider text-green-600">단위 마진</p>
              <p className="mt-1 text-lg font-semibold">{formatKrw(bundleAnalysis.combinedMargin)}</p>
              <p className="mt-1 text-xs text-green-700">
                개별 마진 합계 대비 {bundleAnalysis.combinedMargin - bundleAnalysis.individualMarginSum >= 0 ? '증가' : '감소'}{' '}
                {formatKrw(bundleAnalysis.combinedMargin - bundleAnalysis.individualMarginSum)} · 마진율{' '}
                {formatPercentage(bundleAnalysis.combinedMarginRate)}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-500">조합 시뮬레이션을 위해 서로 다른 두 개의 시술을 선택하세요.</p>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900">신규 시술 수익성 시뮬레이션</h3>
        <p className="mt-1 text-xs text-gray-500">
          가격과 예상 소모 비용을 입력하면 예상 마진과 손익분기 건수를 계산합니다. 인력 비용은 현재 평균 인건비를 기반으로 추정합니다.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm text-gray-700">
            <span className="font-semibold text-gray-900">시술명</span>
            <input
              type="text"
              value={newProcedureInputs.name}
              onChange={event => setNewProcedureInputs(prev => ({ ...prev, name: event.target.value }))}
              placeholder="예: 신규 리프팅 300샷"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-gray-700">
            <span className="font-semibold text-gray-900">판매가 (원)</span>
            <input
              type="text"
              inputMode="numeric"
              value={newProcedureInputs.price}
              onChange={event => setNewProcedureInputs(prev => ({ ...prev, price: formatCurrencyString(event.target.value) }))}
              placeholder="예: 600,000"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-gray-700">
            <span className="font-semibold text-gray-900">소모품 비용 (원)</span>
            <input
              type="text"
              inputMode="numeric"
              value={newProcedureInputs.consumableCost}
              onChange={event => setNewProcedureInputs(prev => ({ ...prev, consumableCost: formatCurrencyString(event.target.value) }))}
              placeholder="예: 200,000"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-gray-700">
            <span className="font-semibold text-gray-900">인력 투입 시간 (분)</span>
            <input
              type="number"
              min={0}
              value={newProcedureInputs.laborMinutes}
              onChange={event => setNewProcedureInputs(prev => ({ ...prev, laborMinutes: event.target.value }))}
              placeholder="예: 40"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-gray-700">
            <span className="font-semibold text-gray-900">시술 소요 시간 (분)</span>
            <input
              type="number"
              min={0}
              value={newProcedureInputs.treatmentMinutes}
              onChange={event => setNewProcedureInputs(prev => ({ ...prev, treatmentMinutes: event.target.value }))}
              placeholder="예: 30"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-gray-700">
            <span className="font-semibold text-gray-900">런칭 마케팅비 (원)</span>
            <input
              type="text"
              inputMode="numeric"
              value={newProcedureInputs.marketingSpend}
              onChange={event => setNewProcedureInputs(prev => ({ ...prev, marketingSpend: formatCurrencyString(event.target.value) }))}
              placeholder="예: 500,000"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </label>
        </div>
        {newProcedureSimulation ? (
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">예상 단위 마진</p>
              <p className="mt-1 text-lg font-semibold">{formatKrw(newProcedureSimulation.margin)}</p>
              <p className="mt-1 text-xs text-blue-700">
                소모품 {formatKrw(parseCurrencyInput(newProcedureInputs.consumableCost))} · 인건비 {formatKrw(newProcedureSimulation.laborCost)} · 고정비{' '}
                {formatKrw(newProcedureSimulation.fixedCost)}
              </p>
            </div>
            <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-900">
              <p className="text-xs font-semibold uppercase tracking-wider text-green-600">예상 마진율</p>
              <p className="mt-1 text-lg font-semibold">{formatPercentage(newProcedureSimulation.marginRate)}</p>
              <p className="mt-1 text-xs text-green-700">
                손익분기 {newProcedureSimulation.breakevenUnits != null ? `${formatCount(newProcedureSimulation.breakevenUnits, 1)}건` : '마케팅비 입력 필요'}
              </p>
            </div>
            <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-900">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">시술 시간</p>
              <p className="mt-1 text-lg font-semibold">
                {Number(newProcedureInputs.treatmentMinutes) > 0 ? `${formatCount(Number(newProcedureInputs.treatmentMinutes))}분` : '-'}
              </p>
              <p className="mt-1 text-xs text-gray-600">
                베드 용량 대비 영향:{' '}
                {Number(newProcedureInputs.treatmentMinutes) > 0
                  ? `${formatCount(
                      Number(newProcedureInputs.treatmentMinutes) /
                        (insights.bedUtilization.perBedCapacityMinutes || 1) *
                        100,
                      1,
                    )}%/베드`
                  : '입력 필요'}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-500">판매가를 입력하면 예상 수익성을 확인할 수 있습니다.</p>
        )}
      </div>
    </div>
  );

  const performanceContent = (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">시술 실적 입력</h3>
          <p className="mt-1 text-xs text-gray-500">
            이번 달 실제 시술 건수와 마케팅비를 입력하세요. 저장하면 마케팅 인사이트에 바로 반영됩니다.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-gray-500">
              운영 세팅 마케팅비:{' '}
              {operationalMarketingBudget > 0 ? formatKrw(operationalMarketingBudget) : '등록된 값이 없습니다.'}
            </span>
            <label
              className={`relative inline-flex items-center ${
                operationalMarketingBudget <= 0 || state.procedures.length === 0
                  ? 'cursor-not-allowed opacity-60'
                  : 'cursor-pointer'
              }`}
            >
              <input
                type="checkbox"
                className="peer sr-only"
                checked={isUniformMarketing}
                onChange={handleUniformMarketingToggle}
                disabled={operationalMarketingBudget <= 0 || state.procedures.length === 0}
              />
              <span className="relative h-6 w-11 rounded-full bg-gray-200 transition-all peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:bg-blue-600 peer-disabled:bg-gray-200 peer-checked:after:translate-x-full peer-checked:after:border-blue-600 after:absolute after:top-[2px] after:start-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-disabled:after:bg-gray-100" />
              <span className="ms-3 text-sm font-medium text-gray-700">마케팅비 균일 배분</span>
            </label>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-white">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">시술명</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">마진율</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">단위 마진</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">실적 입력</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">마케팅비</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">실적 매출</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">실적 마진</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">ROAS</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {insights.procedures.map(procedure => {
                const editorValue = editorValues[procedure.id] ?? { performed: '', marketingSpend: '' };
                const roas =
                  procedure.marketingSpend != null && procedure.marketingSpend > 0
                    ? procedure.revenue / procedure.marketingSpend
                    : null;
                return (
                  <tr key={procedure.id} className="hover:bg-gray-50">
                    <td className="max-w-[220px] px-4 py-2 font-medium text-gray-900">{procedure.name}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{formatPercentage(procedure.marginRate)}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{formatKrw(procedure.unitMargin)}</td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        value={editorValue.performed}
                        onChange={event => handleEditorChange(procedure.id, 'performed', event.target.value)}
                        onBlur={() => handleEditorBlur(procedure.id)}
                        className="w-24 rounded-md border border-gray-300 px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editorValue.marketingSpend}
                        onChange={event => handleEditorChange(procedure.id, 'marketingSpend', event.target.value)}
                        onBlur={() => handleEditorBlur(procedure.id)}
                        className="w-28 rounded-md border border-gray-300 px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700">{formatKrw(procedure.revenue)}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{formatKrw(procedure.profit)}</td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {roas != null ? `${formatCount(roas, 2)}배` : '-'}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleClearActual(procedure.id)}
                        className="rounded-md border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:border-gray-300 hover:text-gray-900"
                      >
                        초기화
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  let bodyContent: React.ReactNode;
  switch (activeTab) {
    case 'overview':
      bodyContent = overviewContent;
      break;
    case 'goals':
      bodyContent = goalsContent;
      break;
    case 'operations':
      bodyContent = operationsContent;
      break;
    case 'bundles':
      bodyContent = bundlesContent;
      break;
    case 'performance':
      bodyContent = performanceContent;
      break;
    default:
      bodyContent = overviewContent;
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">마케팅 인사이트</h2>
          <p className="mt-1 text-sm text-gray-600">
            실적 기반의 마케팅 전략을 설계하고, 인력·장비 용량 및 신규 시술 수익성을 빠르게 검토하세요.
          </p>
        </div>
        <PhaseSaveControls phaseId="marketing" className="md:w-auto" />
      </header>

      <nav className="overflow-x-auto">
        <div className="flex gap-2">
          {MARKETING_TABS.map(tab => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'border border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:text-blue-600'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="mt-6">{bodyContent}</div>
    </section>
  );
};

export default MarketingInsightsSection;
