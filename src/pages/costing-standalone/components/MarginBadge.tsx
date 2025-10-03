import React from 'react';

interface MarginBadgeProps {
  marginRate: number;
}

const MarginBadge: React.FC<MarginBadgeProps> = ({ marginRate }) => {
  const getStatusConfig = (rate: number) => {
    if (rate >= 40) {
      return {
        text: '양호',
        className: 'bg-blue-100 text-blue-800 border-blue-200'
      };
    }
    if (rate >= 30) {
      return {
        text: '개선 필요',
        className: 'bg-amber-100 text-amber-800 border-amber-200'
      };
    }
    return {
      text: '주의',
      className: 'bg-red-100 text-red-800 border-red-200'
    };
  };

  const status = getStatusConfig(marginRate);

  return (
    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded border ${status.className}`}>
      {status.text}
    </span>
  );
};

export default MarginBadge;
