import React from 'react';

interface MarginBadgeProps {
  marginRate: number;
}

const MarginBadge: React.FC<MarginBadgeProps> = ({ marginRate }) => {
  const getStatusConfig = (rate: number) => {
    if (rate >= 50) {
      return {
        text: '우수',
        className: 'bg-blue-100 text-blue-800 border-blue-200'
      };
    }
    if (rate >= 30) {
      return {
        text: '양호',
        className: 'bg-blue-50 text-blue-600 border-blue-100'
      };
    }
    if (rate >= 0) {
      return {
        text: '관심',
        className: 'bg-blue-50 text-blue-400 border-blue-100'
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
