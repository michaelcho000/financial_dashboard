import React, { useMemo, useState } from 'react';
import Header from '../components/Header';
import IncomeStatementTable from '../components/IncomeStatementTable';
import { formatCurrency, formatMonth } from '../utils/formatters';
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
    { label: '총매출', key: 'totalRevenue', isCost: false, isBold: true },
    { label: '변동비 합계', key: 'variableExpense', isCost: true, isBold: false },
    { label: '고정비 합계', key: 'fixedExpense', isCost: true, isBold: false },
    { label: '총비용', key: 'totalExpense', isCost: true, isBold: true },
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
                      —
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
      <SectionCard title="월별 고정비">
        <div className="p-4 text-sm text-gray-500">고정비 계정이 설정되지 않았습니다.</div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="월별 고정비">
      <div className="p-4">
        <table className="w-full border-collapse">
          <thead className="border-b-2 border-slate-300">
            <tr>
              <th className="py-3 px-4 text-left text-base font-semibold text-slate-800">계정</th>
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

const IncomeStatementPage: React.FC = () => {
  const {
    currentMonths,
    setCurrentMonths,
    commitDraft,
    hasUnsavedChanges,
    monthMetadata,
    prepareMonth,
    getDefaultSourceMonth,
  } = useFinancials();

  const primaryMonth = currentMonths[0] || null;
  const comparisonMonth = currentMonths[1];

  const monthStatusMap = useMemo(() => new Map(monthMetadata.map(item => [item.month, item])), [monthMetadata]);

  const incrementMonthValue = (month: string): string => {
    const [yearStr, monthStr] = month.split('-');
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    if (Number.isNaN(year) || Number.isNaN(monthIndex)) {
      return month;
    }
    const nextDate = new Date(year, monthIndex + 1, 1);
    const nextYear = nextDate.getFullYear();
    const nextMonth = (nextDate.getMonth() + 1).toString().padStart(2, '0');
    return `${nextYear}-${nextMonth}`;
  };

  const [isMonthModalOpen, setIsMonthModalOpen] = useState(false);
  const [modalContext, setModalContext] = useState<{ targetMonth: string; intent: 'create' | 'reset'; allowMonthEdit: boolean } | null>(null);
  const [modalMonth, setModalMonth] = useState('');
  const [modalMode, setModalMode] = useState<'copyPrevious' | 'blank'>('copyPrevious');
  const [modalSource, setModalSource] = useState<string | null>(null);
  const [modalError, setModalError] = useState('');

  const computeNextMonth = (month: string | null): string => (month ? incrementMonthValue(month) : '');

  const committedMonthsOrdered = useMemo(
    () => [...monthMetadata.filter(item => item.hasCommittedData).map(item => item.month)].sort(),
    [monthMetadata],
  );

  const missingCommittedMonths = useMemo(() => {
    if (committedMonthsOrdered.length <= 1) {
      return [] as string[];
    }
    const committedSet = new Set(committedMonthsOrdered);
    const missing: string[] = [];
    for (let index = 0; index < committedMonthsOrdered.length - 1; index += 1) {
      let cursor = incrementMonthValue(committedMonthsOrdered[index]);
      const boundary = committedMonthsOrdered[index + 1];
      while (cursor < boundary) {
        if (!committedSet.has(cursor)) {
          missing.push(cursor);
        }
        cursor = incrementMonthValue(cursor);
      }
    }
    return missing;
  }, [committedMonthsOrdered]);

  const openMonthModal = (config: { targetMonth: string; intent: 'create' | 'reset'; allowMonthEdit: boolean }) => {
    setModalContext(config);
    const initialMonth = config.targetMonth || primaryMonth || '';
    setModalMonth(initialMonth);
    setModalError('');
    const source = getDefaultSourceMonth(initialMonth);
    setModalSource(source);
    setModalMode(source ? 'copyPrevious' : 'blank');
    setIsMonthModalOpen(true);
  };

  const closeMonthModal = () => {
    setIsMonthModalOpen(false);
    setModalContext(null);
    setModalError('');
  };

  const handleModalMonthChange = (value: string) => {
    setModalMonth(value);
    const source = getDefaultSourceMonth(value);
    setModalSource(source);
    if (!source && modalMode === 'copyPrevious') {
      setModalMode('blank');
    }
  };

  const handleModalConfirm = () => {
    if (!modalContext) {
      closeMonthModal();
      return;
    }
    if (!modalMonth) {
      setModalError('월을 선택해주세요.');
      return;
    }

    const meta = monthStatusMap.get(modalMonth);
    const effectiveMode = modalMode === 'copyPrevious' && !modalSource ? 'blank' : modalMode;
    const shouldForce = modalContext.intent === 'reset' || Boolean(meta?.hasCommittedData);

    if (effectiveMode === 'copyPrevious' && !modalSource) {
      setModalError('복사할 이전 월을 찾을 수 없습니다. 빈 템플릿으로 생성해주세요.');
      return;
    }

    prepareMonth(modalMonth, {
      mode: effectiveMode,
      sourceMonth: effectiveMode === 'copyPrevious' ? modalSource ?? undefined : undefined,
      force: shouldForce,
    });

    setCurrentMonths([modalMonth, comparisonMonth]);
    closeMonthModal();
  };

  const handleSecondaryMonthChange = (_next: string | null) => true;

  const handlePrimaryMonthChange = (next: string) => {
    const meta = monthStatusMap.get(next);
    if (meta?.hasCommittedData) {
      setCurrentMonths([next, comparisonMonth]);
      return true;
    }
    openMonthModal({ targetMonth: next, intent: 'create', allowMonthEdit: false });
    return false;
  };

  const handleCreateMissingMonth = () => {
    const suggested = computeNextMonth(primaryMonth);
    openMonthModal({ targetMonth: suggested, intent: 'create', allowMonthEdit: true });
  };

  const handleResetCurrentMonth = () => {
    if (!primaryMonth) {
      return;
    }
    openMonthModal({ targetMonth: primaryMonth, intent: 'reset', allowMonthEdit: false });
  };

  return (
    <>
      <Header
        title="손익 관리"
        description="월별 손익 흐름과 고정비 현황을 한 화면에서 확인하세요."
        showMonthSelector
        currentMonths={currentMonths}
        setCurrentMonths={setCurrentMonths}
        onStartMonthChange={handlePrimaryMonthChange}
        onEndMonthChange={handleSecondaryMonthChange}
        actions={(
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCreateMissingMonth}
              className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-semibold text-gray-700 hover:bg-gray-100"
            >
              월 생성 / 복사
            </button>
            <button
              type="button"
              onClick={handleResetCurrentMonth}
              disabled={!primaryMonth}
              className={`px-4 py-2 rounded-md text-sm font-semibold ${primaryMonth ? 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
            >
              현재 월 초기화
            </button>
            <button
              type="button"
              onClick={commitDraft}
              disabled={!hasUnsavedChanges}
              className={`px-4 py-2 rounded-md text-sm font-semibold ${hasUnsavedChanges ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
            >
              변경사항 저장
            </button>
          </div>
        )}
      />
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-8">
          <SectionCard title="매출 내역">
            <IncomeStatementTable months={currentMonths} primaryMonth={primaryMonth} display="revenue" />
          </SectionCard>

          <SectionCard title="변동비 내역">
            <IncomeStatementTable months={currentMonths} primaryMonth={primaryMonth} display="expense" costBehaviorFilter="variable" />
          </SectionCard>

          <SummarySection months={currentMonths} />
        </div>
        <div className="lg:col-span-1 space-y-8">
          <FixedCostsSummary months={currentMonths} />
        </div>
      </div>

      {isMonthModalOpen && modalContext && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                {modalContext.intent === 'reset' ? '월 데이터 초기화' : '새 월 데이터 준비'}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {modalContext.intent === 'reset'
                  ? '현재 월 데이터를 복사하거나 템플릿으로 초기화할 수 있습니다. 저장 시 반영됩니다.'
                  : '입력되지 않은 월을 직전 데이터로 복사하거나 템플릿으로 새로 시작할 수 있습니다.'}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">대상 월</label>
                <input
                  type="month"
                  value={modalMonth}
                  onChange={(e) => handleModalMonthChange(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-base"
                  disabled={!modalContext.allowMonthEdit}
                />
              </div>

              <div className="space-y-2">
                <span className="block text-sm font-medium text-slate-700">초기화 옵션</span>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="monthMode"
                    value="copyPrevious"
                    checked={modalMode === 'copyPrevious'}
                    onChange={() => setModalMode('copyPrevious')}
                    disabled={!modalSource}
                  />
                  <span className={modalSource ? '' : 'text-gray-400'}>
                    직전 데이터를 복사
                    {modalSource ? ` (${formatMonth(modalSource)})` : ' (이용 가능 데이터 없음)'}
                  </span>
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="monthMode"
                    value="blank"
                    checked={modalMode === 'blank'}
                    onChange={() => setModalMode('blank')}
                  />
                  <span>템플릿 구조로 빈 월 생성</span>
                </label>
              </div>

              {modalError && (
                <div className="text-sm text-red-600">{modalError}</div>
              )}

              <div className="text-xs text-slate-500 space-y-1">
                <div>
                  작성된 월: {monthMetadata.filter(item => item.hasCommittedData).map(item => item.month).join(', ') || '없음'}
                </div>
                <div>
                  저장 대기 중인 월: {monthMetadata.filter(item => !item.hasCommittedData && item.hasDraftData).map(item => item.month).join(', ') || '없음'}
                </div>
                <div>
                  누락된 월: {missingCommittedMonths.length ? missingCommittedMonths.join(', ') : '없음'}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeMonthModal}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-semibold text-gray-600 hover:bg-gray-100"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleModalConfirm}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-semibold hover:bg-blue-700"
              >
                생성
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default IncomeStatementPage;
