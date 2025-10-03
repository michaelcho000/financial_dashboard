import React from 'react';
import { formatPercentage } from '../../../utils/formatters';

interface MarginChartProps {
  data: Array<{
    name: string;
    marginRate: number;
  }>;
}

const MarginChart: React.FC<MarginChartProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="py-8 text-center text-gray-400">
        표시할 데이터가 없습니다.
      </div>
    );
  }

  const maxRate = Math.max(...data.map(d => d.marginRate), 100);

  return (
    <div className="space-y-3">
      {data.map((item, index) => {
        const percentage = (item.marginRate / maxRate) * 100;
        const color =
          item.marginRate >= 50
            ? 'bg-blue-700'
            : item.marginRate >= 30
            ? 'bg-blue-500'
            : item.marginRate >= 0
            ? 'bg-blue-300'
            : 'bg-red-600';

        return (
          <div key={index} className="flex items-center gap-3">
            {/* 시술명 */}
            <div className="w-24 text-sm font-medium text-gray-700 truncate">
              {item.name}
            </div>

            {/* 막대 */}
            <div className="flex-1 h-6 bg-gray-100 rounded-md overflow-hidden">
              <div
                className={`h-full ${color} transition-all duration-300`}
                style={{ width: `${percentage}%` }}
              />
            </div>

            {/* 마진율 */}
            <div className="w-16 text-sm font-semibold text-gray-900 text-right">
              {formatPercentage(item.marginRate)}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MarginChart;
