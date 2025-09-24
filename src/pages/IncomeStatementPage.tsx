import React, { useMemo, useState } from 'react';
import Header from '../components/Header';
import IncomeStatementTable from '../components/IncomeStatementTable';
import { formatCurrency, formatMonth } from '../utils/formatters';
import NotificationModal from '../components/common/NotificationModal';
import useSaveNotification from '../hooks/useSaveNotification';
import { isMonthWithinYearRange } from '../utils/dateHelpers';
import { AccountRow } from '../components/tables/AccountRow';
import { useFinancials } from '../contexts/FinancialDataContext';

const SectionCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
    <div className="p-4 border-b bg-slate-100">
      <h2 className="text-lg font-bold text-slate-800">{title}</h2>
    </div>
    {children}
  </div>
);

const SummarySection: React.FC<{ months: [string, string | null] }> = ({ months }) => {
  const { statement } = useFinancials();
  const { calculatedData } = statement;
  const validMonths = months.filter(Boolean) as string[];

  const summaryItems = [
    { label: '총 매출', key: 'totalRevenue', isCost: false, isBold: true },
    { label: '변동비 합계', key: 'variableExpense', isCost: true, isBold: false },
    { label: '고정비 합계', key: 'fixedExpense', isCost: true, isBold: false },
    { label: '총 비용', key: 'totalExpense', isCost: true, isBold: true },
    { label: '영업이익', key: 'operatingIncome', isCost: false, isBold: true },
  ] as const;

  return (
    <SectionCard title="손익 요약">
      <table className="w-full">
        <tbody>
          {summaryItems.map(item => (
            <tr
              key={item.key}
              className={`border-b border-gray-200 last:border-b-0 ${item.isBold ? 'font-semibold bg-slate-50' : ''}`}
            >
              <td className={`py-3 px-4 text-base ${item.isBold ? 'text-slate-800' : 'text-slate-600'}`}>
                {item.label}
              </td>
              {validMonths.map(month => {
                const monthData = calculatedData[month];
                if (!monthData) {
                  return (
                    <td key={month} className="py-3 px-4 text-right text-base text-gray-400">
                      -
                    </td>
                  );
                }

                const value = monthData[item.key as keyof typeof monthData] as number;
                const displayAsNegative = item.isCost || value < 0;

                return (
                  <td
                    key={month}
                    className={`py-3 px-4 text-base text-right ${displayAsNegative ? 'text-red-600' : 'text-slate-800'}`}
                  >
                    {formatCurrency(value, { alwaysParentheses: item.isCost || value < 0 })}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </SectionCard>
  );
};

const FixedCostsSummary: React.FC<{ months: [string, string | null] }> = ({ months }) => {
  const { fixed } = useFinancials();
  const { accounts: fixedAccounts } = fixed;
  const validMonths = months.filter(Boolean) as string[];

  if (fixedAccounts.length === 0) {
    return (
      <SectionCard title="고정비 상세">
        <div className="p-4 text-sm text-gray-500">등록된 고정비 계정이 없습니다.</div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="고정비 상세">
      <div className="p-4">
        <table className="w-full border-collapse">
          <thead className="border-b-2 border-slate-300">
            <tr>
              <th className="py-3 px-4 text-left text-base font-semibold text-slate-800">계정명</th>
              {validMonths.map(month => (
                <th key={month} className="py-3 px-4 text-right text-sm font-semibold text-slate-600 uppercase tracking-wider">
                  {formatMonth(month)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fixedAccounts.map(account => (
              <AccountRow
                key={account.id}
                account={account}
                months={validMonths}
                isSubItem={false}
                disableEditing
              />
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
};

const formatMonthLabel = (month: string): string => {
  const [year, monthPart] = month.split('-');
  const numericMonth = Number(monthPart);
  if (!year || Number.isNaN(numericMonth)) {
    return month;
  }
  return `${year}년 ${numericMonth}월`;
};

const formatSavedAt = (iso?: string): string | null => {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const IncomeStatementPage: React.FC = () => {
  const {
    currentMonths,
    setCurrentMonths,
    commitDraft,
    resetDraft,
    unsaved,
    monthMetadata,
    yearConfig,
    lastCommittedAt,
  } = useFinancials();

  const { notifySave, notifyCancel, notificationProps } = useSaveNotification();

  const { minYear: minAllowedYear, maxYear: maxAllowedYear } = yearConfig;
  const [monthError, setMonthError] = useState<string | null>(null);

  const primaryMonth = currentMonths[0] ?? null;
  const comparisonMonth = currentMonths[1];

  const monthStatusMap = useMemo(() => new Map(monthMetadata.map(item => [item.month, item])), [monthMetadata]);
  const primaryMonthMeta = primaryMonth ? monthStatusMap.get(primaryMonth) : undefined;

  const handleStartMonthChange = (nextMonth: string) => {
    if (!nextMonth) {
      return false;
    }
    if (!isMonthWithinYearRange(nextMonth, minAllowedYear, maxAllowedYear)) {
      setMonthError(`선택 가능한 기간은 ${minAllowedYear}년부터 ${maxAllowedYear}년까지입니다.`);
      return false;
    }
    setMonthError(null);
    setCurrentMonths([nextMonth, comparisonMonth]);
    return true;
  };

  const handleComparisonMonthChange = (nextMonth: string | null) => {
    if (!primaryMonth) {
      return false;
    }
    if (nextMonth && !isMonthWithinYearRange(nextMonth, minAllowedYear, maxAllowedYear)) {
      setMonthError(`비교 월은 ${minAllowedYear}년부터 ${maxAllowedYear}년까지만 선택할 수 있습니다.`);
      return false;
    }
    setMonthError(null);
    setCurrentMonths([primaryMonth, nextMonth]);
    return true;
  };

  const handleCommitChanges = () => {
    if (!unsaved.statement) {
      return;
    }
    commitDraft();
    setMonthError(null);
    const message = primaryMonth
      ? `${formatMonthLabel(primaryMonth)} 데이터를 저장했습니다.`
      : '변경사항을 저장했습니다.';
    notifySave(message);
  };

  const handleCancelChanges = () => {
    if (!unsaved.statement) {
      return;
    }
    resetDraft();
    setMonthError(null);
    notifyCancel('변경사항을 취소했습니다.');
  };

  const savedAtLabel = formatSavedAt(primaryMonthMeta?.committedMeta?.savedAt ?? lastCommittedAt ?? undefined);
  const showMissingNotice = primaryMonth !== null && !primaryMonthMeta?.hasCommittedData;

  return (
    <div>
      <Header
        title="손익 보고서"
        description="월별 매출과 비용 흐름을 살펴보고 경영 현황을 정리하세요."
        showMonthSelector
        currentMonths={currentMonths}
        setCurrentMonths={setCurrentMonths}
        onStartMonthChange={handleStartMonthChange}
        onEndMonthChange={handleComparisonMonthChange}
        actions={(
          <div className="flex flex-col items-end gap-2">
            <span className="text-xs text-gray-500">
              {unsaved.any
                ? '저장되지 않은 변경사항이 있습니다.'
                : savedAtLabel
                  ? `최근 저장: ${savedAtLabel}`
                  : '아직 저장된 데이터가 없습니다.'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelChanges}
                disabled={!unsaved.statement}
                className={`px-4 py-2 rounded-md text-sm font-semibold ${unsaved.statement ? 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
              >
                변경 취소
              </button>
              <button
                type="button"
                onClick={handleCommitChanges}
                disabled={!unsaved.statement}
                className={`px-4 py-2 rounded-md text-sm font-semibold ${unsaved.statement ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
              >
                변경사항 저장
              </button>
            </div>
          </div>
        )}
      />

      {monthError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {monthError}
        </div>
      )}

      {showMissingNotice && primaryMonth && (
        <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
          {formatMonthLabel(primaryMonth)} 데이터가 아직 저장되지 않았습니다. 사이드바의 ‘월 데이터 관리’에서 새 월을 생성하거나 직전 달을 복사해 시작하세요.
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-8">
          <SectionCard title="매출 상세">
            <IncomeStatementTable months={currentMonths} primaryMonth={primaryMonth} display="revenue" />
          </SectionCard>

          <SectionCard title="변동비 상세">
            <IncomeStatementTable months={currentMonths} primaryMonth={primaryMonth} display="expense" costBehaviorFilter="variable" />
          </SectionCard>

          <SummarySection months={currentMonths} />
        </div>
        <div className="lg:col-span-1 space-y-8">
          <FixedCostsSummary months={currentMonths} />
        </div>
      </div>

      <NotificationModal {...notificationProps} />

    </div>
  );
};

export default IncomeStatementPage;














