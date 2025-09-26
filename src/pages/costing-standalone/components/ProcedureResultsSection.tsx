import React, { useMemo } from 'react';
import { useStandaloneCosting } from '../state/StandaloneCostingProvider';
import { formatKrw, formatPercentage } from '../../../utils/formatters';

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

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">결과 대시보드</h2>
        <p className="mt-1 text-sm text-gray-600">시술별 원가, 마진율, 손익분기 건수를 확인합니다.</p>
      </header>

      <div className="overflow-x-auto">
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
