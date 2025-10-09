import React, { useMemo } from 'react';
import { useStandaloneCosting } from '../state/StandaloneCostingProvider';
import { formatKrw, formatPercentage } from '../../../utils/formatters';
import {
  allocateUnallocatedLaborCost,
  calculateLaborCostAllocation,
  summarizeFixedCosts,
} from '../../../services/standaloneCosting/calculations';
import StatCard from './StatCard';
import MarginChart from './MarginChart';

const ProcedureResultsSection: React.FC = () => {
  const { state, setResultsIncludeUnallocatedLabor } = useStandaloneCosting();

  const rows = useMemo(
    () =>
      state.breakdowns.map(breakdown => ({
        breakdown,
        procedure: state.procedures.find(procedure => procedure.id === breakdown.procedureId) || null,
      })),
    [state.breakdowns, state.procedures],
  );

  const { facilityTotal, commonTotal, marketingTotal } = useMemo(
    () => summarizeFixedCosts(state.fixedCosts),
    [state.fixedCosts],
  );

  const laborAllocation = useMemo(
    () =>
      calculateLaborCostAllocation({
        staff: state.staff,
        breakdowns: state.breakdowns,
        actuals: state.procedureActuals,
      }),
    [state.breakdowns, state.procedureActuals, state.staff],
  );

  const hasActuals = useMemo(
    () => state.procedureActuals.some(actual => actual.performed > 0),
    [state.procedureActuals],
  );

  const includeUnallocatedLabor = state.resultsIncludeUnallocatedLabor;

  const unallocatedDistribution = useMemo(
    () =>
      allocateUnallocatedLaborCost({
        procedures: state.procedures,
        actuals: state.procedureActuals,
        unallocatedLaborCost: laborAllocation.unallocatedLaborCost,
      }),
    [laborAllocation.unallocatedLaborCost, state.procedureActuals, state.procedures],
  );

  const additionalLaborCostMap = useMemo(() => {
    const map = new Map<string, number>();
    unallocatedDistribution.entries.forEach(entry => {
      map.set(entry.procedureId, entry.additionalUnitCost);
    });
    return map;
  }, [unallocatedDistribution.entries]);

  const enhancedRows = useMemo(
    () =>
      rows.map(entry => {
        const additionalLaborCost = includeUnallocatedLabor
          ? additionalLaborCostMap.get(entry.breakdown.procedureId) ?? 0
          : 0;
        const price = entry.procedure?.price ?? 0;
        const directLaborWithAllocation = entry.breakdown.directLaborCost + additionalLaborCost;
        const totalCostWithAllocation = entry.breakdown.totalCost + additionalLaborCost;
        const marginWithAllocation = price - totalCostWithAllocation;
        const marginRateWithAllocation = price ? (marginWithAllocation / price) * 100 : 0;
        const contribution = price - (entry.breakdown.consumableCost + directLaborWithAllocation);
        const breakevenWithAllocation = contribution > 0 ? facilityTotal / contribution : null;

        return {
          ...entry,
          additionalLaborCost,
          display: {
            directLaborCost: directLaborWithAllocation,
            totalCost: totalCostWithAllocation,
            margin: marginWithAllocation,
            marginRate: marginRateWithAllocation,
            breakevenUnits: breakevenWithAllocation,
          },
        };
      }),
    [additionalLaborCostMap, facilityTotal, includeUnallocatedLabor, rows],
  );

  const summary = useMemo(() => {
    if (enhancedRows.length === 0) {
      return { avgMarginRate: null as number | null, minBreakeven: null as number | null };
    }

    const marginRates = enhancedRows
      .map(({ display }) => display.marginRate)
      .filter(rate => Number.isFinite(rate));

    const avgMarginRate = marginRates.length
      ? marginRates.reduce((acc, value) => acc + value, 0) / marginRates.length
      : null;

    const minBreakeven = enhancedRows.reduce<number | null>((acc, { display }) => {
      if (display.breakevenUnits === null) {
        return acc;
      }
      const value = Math.ceil(display.breakevenUnits);
      if (!Number.isFinite(value)) {
        return acc;
      }
      return acc === null || value < acc ? value : acc;
    }, null);

    return {
      avgMarginRate,
      minBreakeven,
    };
  }, [enhancedRows]);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <header className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">결과 대시보드</h2>
          <p className="mt-1 text-sm text-gray-600">시술별 원가, 마진율, 손익분기 건수를 확인합니다.</p>
        </div>
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={includeUnallocatedLabor}
            onChange={event => setResultsIncludeUnallocatedLabor(event.target.checked)}
          />
          <span className="h-6 w-11 rounded-full bg-gray-200 transition peer-checked:bg-blue-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full" />
          <span className="ms-3 text-sm font-medium text-gray-700">미배분 인건비 반영</span>
        </label>
      </header>

      <div className="grid gap-3 md:grid-cols-5">
        <StatCard
          title="월 시설·운영비"
          value={formatKrw(facilityTotal)}
          description="시술 시간에 비례해 분배되는 금액입니다."
        />
        <StatCard
          title="월 공통비용"
          value={formatKrw(commonTotal)}
          description="시나리오 탭에서 손익을 검토합니다."
        />
        <StatCard
          title="월 마케팅 비용"
          value={formatKrw(marketingTotal)}
          description="인사이트 탭에서 증감 시뮬레이션을 진행합니다."
        />
        <StatCard
          title="평균 마진율"
          value={summary.avgMarginRate !== null ? formatPercentage(summary.avgMarginRate) : '-'}
          description="등록된 시술의 마진율 평균입니다."
          variant="info"
        />
        <StatCard
          title="미배분 인건비"
          value={hasActuals ? formatKrw(laborAllocation.unallocatedLaborCost) : '실적 필요'}
          description={
            hasActuals
              ? `실제 투입 기준 미배분 금액입니다. 배분율 ${formatPercentage(laborAllocation.allocationRate * 100)}`
              : '시술 실적을 입력하면 미배분 인건비를 확인할 수 있습니다.'
          }
          variant={hasActuals && laborAllocation.unallocatedLaborCost > 0 ? 'warning' : 'info'}
        />
      </div>

      {/* 마진율 차트 추가 */}
      {enhancedRows.length > 0 && (
        <div className="mt-6">
          <h3 className="text-base font-semibold text-gray-900 mb-3">
            시술별 마진율 비교
          </h3>
          <MarginChart
            data={enhancedRows.map(({ procedure, display }) => ({
              name: procedure?.name || '삭제된 시술',
              marginRate: display.marginRate,
            }))}
          />
        </div>
      )}

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">시술명</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500">판매가</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500">직접 인건비</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500">소모품</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500">고정비 배분</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500">총 원가</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500">마진</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500">마진율</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500">손익분기</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {enhancedRows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-gray-400" colSpan={9}>
                  계산된 시술이 없습니다. 시술을 등록해 원가를 확인하세요.
                </td>
              </tr>
            ) : (
              enhancedRows.map(({ breakdown, procedure, additionalLaborCost, display }) => (
                <tr key={breakdown.procedureId} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">
                    {procedure ? procedure.name : '삭제된 시술'}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-900">{formatKrw(procedure?.price ?? 0)}</td>
                  <td className="px-4 py-2 text-right text-gray-600">
                    {formatKrw(display.directLaborCost)}
                    {includeUnallocatedLabor && additionalLaborCost > 0 && (
                      <span className="ml-1 text-xs text-amber-600">(+ {formatKrw(additionalLaborCost)})</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-600">{formatKrw(breakdown.consumableCost)}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{formatKrw(breakdown.fixedCostAllocated)}</td>
                  <td className="px-4 py-2 text-right text-gray-900">{formatKrw(display.totalCost)}</td>
                  <td
                    className={`px-4 py-2 text-right font-semibold ${
                      display.margin >= 0 ? 'text-blue-900' : 'text-red-600'
                    }`}
                  >
                    {formatKrw(display.margin)}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-900">{formatPercentage(display.marginRate)}</td>
                  <td className="px-4 py-2 text-right text-gray-600">
                    {display.breakevenUnits !== null
                      ? `${Math.ceil(display.breakevenUnits).toLocaleString('ko-KR')}건`
                      : '기여이익 부족'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default ProcedureResultsSection;
