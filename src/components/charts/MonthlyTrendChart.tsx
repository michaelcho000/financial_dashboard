

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CalculatedMonthData } from '../../types';
import { formatCurrency, formatMonth } from '../../utils/formatters';

interface MonthlyTrendChartProps {
  data: { [month: string]: CalculatedMonthData };
}

const MonthlyTrendChart: React.FC<MonthlyTrendChartProps> = ({ data }) => {
  const chartData = Object.keys(data)
    .sort()
    .map(month => ({
      month: formatMonth(month).split(' ')[1],
      '총 매출': data[month].totalRevenue,
      '총 지출': data[month].totalExpense,
      '영업이익': data[month].operatingIncome,
    }));

  if (chartData.length < 2) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        차트를 표시하려면 2개월 이상의 데이터가 필요합니다.
      </div>
    );
  }

  const currencyFormatter = (value: number) => {
    if (Math.abs(value) >= 1_000_000_000) {
        return `${(value / 1_000_000_000).toFixed(1)}억`;
    }
    if (Math.abs(value) >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(0)}백만`;
    }
    return formatCurrency(value);
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={chartData}
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="month" tick={{ fill: '#6b7280' }} />
        <YAxis tickFormatter={currencyFormatter} tick={{ fill: '#6b7280' }} />
        <Tooltip formatter={(value: number) => formatCurrency(value)} />
        <Legend />
        <Line type="monotone" dataKey="총 매출" stroke="#3b82f6" strokeWidth={2} activeDot={{ r: 8 }} />
        <Line type="monotone" dataKey="총 지출" stroke="#ef4444" strokeWidth={2} />
        <Line type="monotone" dataKey="영업이익" stroke="#f59e0b" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default MonthlyTrendChart;
