export const formatCurrency = (value: number, options: { alwaysParentheses?: boolean } = {}): string => {
  if (Number.isNaN(value)) {
    return '₩0';
  }

  const isNegative = value < 0;
  const absoluteValue = Math.abs(value);
  const formatted = new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(absoluteValue);

  if (options.alwaysParentheses || isNegative) {
    return `(${formatted})`;
  }

  return formatted;
};

export const formatPercentage = (value: number): string => {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return '0.00%';
  }
  return `${value.toFixed(2)}%`;
};

export const formatMonth = (month: string): string => {
  const [year, monthPart] = month.split('-');
  const numericMonth = Number(monthPart);
  if (!year || Number.isNaN(numericMonth)) {
    return month;
  }
  return `${year}년 ${numericMonth}월`;
};
