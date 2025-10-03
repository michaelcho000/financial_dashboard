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

export const formatKrw = (value: number): string => {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return '0원';
  }
  const rounded = Math.round(value);
  return `${rounded.toLocaleString('ko-KR')}원`;
};

export const parseNumberInput = (value: string): string => {
  if (!value) {
    return '';
  }

  const sanitized = value.replace(/[^0-9.]/g, '');
  if (!sanitized) {
    return '';
  }

  const [integerPart, ...decimalParts] = sanitized.split('.');
  const decimals = decimalParts.join('');

  if (decimals.length > 0) {
    return `${integerPart || '0'}.${decimals}`;
  }

  return integerPart;
};

export const formatNumberInput = (value: string | number): string => {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = typeof value === 'number' ? value.toString() : value;
  const sanitized = parseNumberInput(stringValue);

  if (!sanitized) {
    return '';
  }

  const [integerPart, ...decimalParts] = sanitized.split('.');
  const decimals = decimalParts.join('');
  const formattedInteger = Number(integerPart || '0').toLocaleString('ko-KR');

  return decimals.length > 0 ? `${formattedInteger}.${decimals}` : formattedInteger;
};
