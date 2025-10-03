import React from 'react';
import { ProcedureFormValues, ProcedureCostBreakdown } from '../../../services/standaloneCosting/types';
import { formatKrw, formatPercentage } from '../../../utils/formatters';
import MarginBadge from './MarginBadge';

interface ProcedureCardProps {
  procedure: ProcedureFormValues;
  breakdown: ProcedureCostBreakdown | null;
  onEdit: (procedure: ProcedureFormValues) => void;
  onDuplicate: (procedure: ProcedureFormValues) => void;
}

const ProcedureCard: React.FC<ProcedureCardProps> = ({
  procedure,
  breakdown,
  onEdit,
  onDuplicate,
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      {/* 시술명 */}
      <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
        {procedure.name}
      </h3>

      {/* 판매가 */}
      <div className="mt-2">
        <span className="text-2xl font-bold text-gray-900">
          {formatKrw(procedure.price)}
        </span>
      </div>

      {/* 구분선 */}
      <div className="my-4 border-t border-gray-200"></div>

      {breakdown ? (
        <>
          {/* 원가 정보 */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">원가</span>
              <span className="font-medium text-gray-900">
                {formatKrw(breakdown.totalCost)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">마진</span>
              <span className={`font-medium ${breakdown.margin >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                {formatKrw(breakdown.margin)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">마진율</span>
              <div className="flex items-center gap-2">
                <span className={`font-semibold ${
                  breakdown.marginRate >= 50
                    ? 'text-blue-700'
                    : breakdown.marginRate >= 30
                    ? 'text-blue-500'
                    : breakdown.marginRate >= 0
                    ? 'text-blue-300'
                    : 'text-red-600'
                }`}>
                  {formatPercentage(breakdown.marginRate)}
                </span>
                <MarginBadge marginRate={breakdown.marginRate} />
              </div>
            </div>
          </div>

          {/* 시술 시간 */}
          <div className="mt-3 text-xs text-gray-500">
            시술: {procedure.treatmentMinutes}분 / 총 체류: {procedure.totalMinutes}분
          </div>

          {/* 손익분기 */}
          {breakdown.breakevenUnits !== null && (
            <div className="mt-2 rounded-md border border-blue-100 bg-blue-50 p-2 text-xs">
              <span className="text-blue-700">손익분기:</span>{' '}
              <span className="font-medium text-blue-900">
                {Math.ceil(breakdown.breakevenUnits).toLocaleString()}건
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="py-4 text-center text-sm text-gray-400">
          원가 계산 중 오류가 발생했습니다.
        </div>
      )}

      {/* 메모 (있을 경우만 표시) */}
      {procedure.notes && (
        <div className="mt-3 text-xs text-gray-500 line-clamp-2">
          {procedure.notes}
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => onEdit(procedure)}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
        >
          편집
        </button>
        <button
          onClick={() => onDuplicate(procedure)}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
        >
          복사
        </button>
      </div>
    </div>
  );
};

export default ProcedureCard;
