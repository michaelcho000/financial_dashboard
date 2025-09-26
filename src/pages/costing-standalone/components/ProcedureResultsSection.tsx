import React, { useMemo } from 'react';
import { useStandaloneCosting } from '../state/StandaloneCostingProvider';
import { formatKrw, formatPercentage } from '../../../utils/formatters';
import { summarizeFixedCosts } from '../../../services/standaloneCosting/calculations';

const ProcedureResultsSection: React.FC = () => {
  const { state } = useStandaloneCosting();

  const rows = useMemo(
    () =>
      state.breakdowns.map(breakdown => ({
        breakdown,
        procedure: state.procedures.find(procedure => procedure.id === breakdown.procedureId) || null,
      })),
    [state.breakdowns, state.procedures],
  );

  const { facilityTotal, commonTotal } = useMemo(
    () => summarizeFixedCosts(state.fixedCosts),
    [state.fixedCosts],
  );

  const summary = useMemo(() => {
    if (rows.length === 0) {
      return { avgMarginRate: null as number | null, minBreakeven: null as number | null };
    }

    const marginRates = rows
      .map(({ breakdown }) => breakdown.marginRate)
      .filter(rate => Number.isFinite(rate));

    const avgMarginRate = marginRates.length
      ? marginRates.reduce((acc, value) => acc + value, 0) / marginRates.length
      : null;

    const minBreakeven = rows.reduce<number | null>((acc, { breakdown }) => {
      if (breakdown.breakevenUnits === null) {
        return acc;
      }
      const value = Math.ceil(breakdown.breakevenUnits);
      if (!Number.isFinite(value)) {
        return acc;
      }
      return acc === null || value < acc ? value : acc;
    }, null);

    return {
      avgMarginRate,
      minBreakeven,
    };
  }, [rows]);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">결과 대시보드</h2>
        <p className="mt-1 text-sm text-gray-600">시술별 원가, 마진율, 손익분기 건수를 확인합니다.</p>
      </header>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm">
          <p className="text-xs font-semibold text-gray-500">월 시설·운영비</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{formatKrw(facilityTotal)}</p>
          <p className="mt-1 text-xs text-gray-500">시술 시간에 비례해 분배되는 금액입니다.</p>
        </div>
        <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm">
          <p className="text-xs font-semibold text-gray-500">월 공통비용</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{formatKrw(commonTotal)}</p>
          <p className="mt-1 text-xs text-gray-500">시나리오/마케팅 탭에서 증감하며 검토합니다.</p>
        </div>
        <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm">
          <p className="text-xs font-semibold text-gray-500">평균 마진율</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {summary.avgMarginRate !== null ? formatPercentage(summary.avgMarginRate) : '-'}
          </p>
          <p className="mt-1 text-xs text-gray-500">등록된 시술의 마진율 평균입니다.</p>
        </div>
        <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm">
          <p className="text-xs font-semibold text-gray-500">최소 손익분기 건수</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {summary.minBreakeven !== null ? `${summary.minBreakeven.toLocaleString('ko-KR')}건` : '계산 불가'}
          </p>
          <p className="mt-1 text-xs text-gray-500">손익분기 계산이 가능한 시술 중 최솟값입니다.</p>
        </div>
      </div>

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
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-gray-400" colSpan={9}>
                  계산된 시술이 없습니다. 시술을 등록해 원가를 확인하세요.
                </td>
              </tr>
            ) : (
              rows.map(({ breakdown, procedure }) => (
                <tr key={breakdown.procedureId} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">
                    {procedure ? procedure.name : '삭제된 시술'}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-900">{formatKrw(procedure?.price ?? 0)}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{formatKrw(breakdown.directLaborCost)}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{formatKrw(breakdown.consumableCost)}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{formatKrw(breakdown.fixedCostAllocated)}</td>
                  <td className="px-4 py-2 text-right text-gray-900">{formatKrw(breakdown.totalCost)}</td>
                  <td
                    className={`px-4 py-2 text-right font-semibold ${
                      breakdown.margin >= 0 ? 'text-blue-900' : 'text-red-600'
                    }`}
                  >
                    {formatKrw(breakdown.margin)}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-900">{formatPercentage(breakdown.marginRate)}</td>
                  <td className="px-4 py-2 text-right text-gray-600">
                    {breakdown.breakevenUnits !== null
                      ? `${Math.ceil(breakdown.breakevenUnits).toLocaleString('ko-KR')}건`
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
