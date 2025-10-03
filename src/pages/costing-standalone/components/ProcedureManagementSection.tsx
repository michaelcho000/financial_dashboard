import React from 'react';
import { useStandaloneCosting } from '../state/StandaloneCostingProvider';
import { formatKrw } from '../../../utils/formatters';

const ProcedureManagementSection: React.FC = () => {
  const { state, removeProcedure, openProcedureEditor } = useStandaloneCosting();

  const handleDelete = (procedureId: string, procedureName: string) => {
    const confirmed = window.confirm(`${procedureName} 시술을 삭제하시겠습니까?`);
    if (confirmed) {
      removeProcedure(procedureId);
    }
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">시술 관리</h2>
          <p className="mt-1 text-sm text-gray-600">판매가와 투입 자원을 등록해 원가를 계산합니다.</p>
        </div>
        <button
          type="button"
          onClick={() => openProcedureEditor(null)}
          className="rounded-md border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          + 시술 등록
        </button>
      </header>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">시술명</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500">판매가</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500">시술 시간</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500">총 체류시간</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {state.procedures.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-gray-400" colSpan={5}>
                  등록된 시술이 없습니다.
                </td>
              </tr>
            ) : (
              state.procedures.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{item.name}</td>
                  <td className="px-4 py-2 text-right text-gray-900">{formatKrw(item.price)}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{item.treatmentMinutes.toLocaleString('ko-KR')}분</td>
                  <td className="px-4 py-2 text-right text-gray-600">{item.totalMinutes.toLocaleString('ko-KR')}분</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openProcedureEditor(item.id)}
                        className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-100"
                      >
                        편집
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id, item.name)}
                        className="rounded-md border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        삭제
                      </button>
                    </div>
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

export default ProcedureManagementSection;
