
export const formatCurrency = (value: number, options: { alwaysParentheses?: boolean } = {}): string => {
  if (isNaN(value)) {
    return '₩0';
  }
  const isNegative = value < 0;
  const absoluteValue = Math.abs(value);
  const formatted = new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(absoluteValue);

  if (options.alwaysParentheses) {
    return `(${formatted})`;
  }

  if (isNegative) {
    return `(${formatted})`;
  }

  return formatted;
};

export const formatPercentage = (value: number): string => {
  if (isNaN(value) || !isFinite(value)) {
    return '0.00%';
  }
  return `${value.toFixed(2)}%`;
};

export const formatMonth = (month: string): string => {
    const [year, monthNum] = month.split('-');
    return `${year}년 ${parseInt(monthNum, 10)}월`;
};