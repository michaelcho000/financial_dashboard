import React from 'react';

interface HeaderProps {
  title: string;
  description: string;
  showMonthSelector?: boolean;
  allowComparisonToggle?: boolean;
  actions?: React.ReactNode;
  currentMonths: [string, string | null];
  setCurrentMonths: React.Dispatch<React.SetStateAction<[string, string | null]>>;
  onStartMonthChange?: (nextMonth: string) => boolean | void;
  onEndMonthChange?: (nextMonth: string | null) => boolean | void;
}

const Header: React.FC<HeaderProps> = ({
  title,
  description,
  showMonthSelector = false,
  allowComparisonToggle = true,
  actions,
  currentMonths,
  setCurrentMonths,
  onStartMonthChange,
  onEndMonthChange,
}) => {
  const [startMonth, endMonth] = currentMonths;

  const handleStartMonthChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    const allowUpdate = onStartMonthChange ? onStartMonthChange(nextValue) : true;
    if (allowUpdate !== false) {
      setCurrentMonths([nextValue, endMonth]);
    }
  };

  const handleEndMonthChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValueRaw = event.target.value;
    const nextValue = nextValueRaw ? nextValueRaw : null;
    const allowUpdate = onEndMonthChange ? onEndMonthChange(nextValue) : true;
    if (allowUpdate !== false) {
      setCurrentMonths([startMonth, nextValue]);
    }
  };

  const showComparison = () => {
    if (!startMonth) {
      return;
    }
    const [year, month] = startMonth.split('-').map(Number);
    if (!year || !month) {
      return;
    }
    const prevDate = new Date(year, month - 2, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = String(prevDate.getMonth() + 1).padStart(2, '0');
    const comparisonMonth = `${prevYear}-${prevMonth}`;
    const allowUpdate = onEndMonthChange ? onEndMonthChange(comparisonMonth) : true;
    if (allowUpdate !== false) {
      setCurrentMonths([startMonth, comparisonMonth]);
    }
  };

  const hideComparison = () => {
    const allowUpdate = onEndMonthChange ? onEndMonthChange(null) : true;
    if (allowUpdate !== false) {
      setCurrentMonths([startMonth, null]);
    }
  };

  return (
    <header className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          <p className="text-base text-gray-500">{description}</p>
        </div>
        {actions && <div className="flex-shrink-0">{actions}</div>}
      </div>

      {showMonthSelector && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600" htmlFor="header-start-month">
              기준월
            </label>
            <input
              id="header-start-month"
              type="month"
              value={startMonth || ''}
              onChange={handleStartMonthChange}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          {allowComparisonToggle && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400">~</span>
              {endMonth ? (
                <>
                  <input
                    type="month"
                    value={endMonth}
                    onChange={handleEndMonthChange}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={hideComparison}
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
                  >
                    비교 해제
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={showComparison}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm text-blue-600 hover:bg-gray-100"
                >
                  + 비교
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </header>
  );
};

export default Header;
