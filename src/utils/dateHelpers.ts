export const getClientCurrentYear = (): number => {
  return new Date().getFullYear();
};

export const buildAllowedYearSequence = (
  baseYear: number,
  pastOffset = 1,
  futureOffset = 1,
): number[] => {
  const years: number[] = [];
  for (let offset = -pastOffset; offset <= futureOffset; offset += 1) {
    years.push(baseYear + offset);
  }
  return Array.from(new Set(years)).sort((a, b) => a - b);
};

export const extractYearFromMonth = (month: string): number | null => {
  if (!month || typeof month !== 'string') {
    return null;
  }
  const [yearPart] = month.split('-');
  const year = Number(yearPart);
  return Number.isFinite(year) ? year : null;
};

export const isYearWithinRange = (year: number, minYear: number, maxYear: number): boolean => {
  return year >= minYear && year <= maxYear;
};

export const isMonthWithinYearRange = (month: string, minYear: number, maxYear: number): boolean => {
  const year = extractYearFromMonth(month);
  if (year === null) {
    return false;
  }
  return isYearWithinRange(year, minYear, maxYear);
};
