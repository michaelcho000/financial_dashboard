import React, { useEffect, useMemo, useState } from 'react';
import { useFinancials } from '../../contexts/FinancialDataContext';
import { isMonthWithinYearRange } from '../../utils/dateHelpers';
import { MonthOverview } from '../../types';

interface MonthManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type MonthStatus = 'saved' | 'draft' | 'empty';

interface MonthItem {
  month: string;
  label: string;
  status: MonthStatus;
  sourceLabel?: string;
  savedAtLabel?: string;
}

const formatMonthLabel = (month: string): string => {
  const [year, monthPart] = month.split('-');
  const numericMonth = Number(monthPart);
  if (!year || Number.isNaN(numericMonth) || numericMonth < 1 || numericMonth > 12) {
    return month;
  }
  return `${year}년 ${numericMonth}월`;
};

const formatSavedAt = (iso?: string): string | undefined => {
  if (!iso) {
    return undefined;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const getMonthStatus = (meta: MonthOverview | undefined): MonthStatus => {
  if (!meta) {
    return 'empty';
  }
  if (meta.hasCommittedData) {
    return 'saved';
  }
  if (meta.hasDraftData) {
    return 'draft';
  }
  return 'empty';
};

const MonthManagementModal: React.FC<MonthManagementModalProps> = ({ isOpen, onClose }) => {
  const {
    monthMetadata,
    prepareMonth,
    getDefaultSourceMonth,
    currentMonths,
    setCurrentMonths,
    yearConfig,
  } = useFinancials();

  const { currentYear, allowedYears, minYear: minAllowedYear, maxYear: maxAllowedYear } = yearConfig;

  const primaryMonth = currentMonths[0] ?? null;
  const primaryYear = primaryMonth ? primaryMonth.split('-')[0] : undefined;

  const initialYear = useMemo(() => {
    if (primaryYear) {
      const numericPrimary = Number(primaryYear);
      if (!Number.isNaN(numericPrimary) && allowedYears.includes(numericPrimary)) {
        return primaryYear;
      }
    }
    return currentYear.toString();
  }, [allowedYears, currentYear, primaryYear]);
  const [selectedYear, setSelectedYear] = useState<string>(initialYear);
  const [selectedTargetMonth, setSelectedTargetMonth] = useState<string | null>(null);
  const [creationMode, setCreationMode] = useState<'copy' | 'blank'>('copy');
  const [selectedSourceMonth, setSelectedSourceMonth] = useState<string | null>(null);
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setCreationMode('copy');
    setSelectedSourceMonth(null);
    setErrorMessage(null);
    if (primaryYear) {
      const numericPrimary = Number(primaryYear);
      if (!Number.isNaN(numericPrimary) && allowedYears.includes(numericPrimary)) {
        setSelectedYear(primaryYear);
        return;
      }
    }
    setSelectedYear(currentYear.toString());
  }, [allowedYears, currentYear, isOpen, primaryYear]);

  const availableYears = useMemo(() => allowedYears.map(year => year.toString()), [allowedYears]);

  useEffect(() => {
    if (!availableYears.includes(selectedYear) && availableYears.length > 0) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  const monthsForYear = useMemo(() => {
    const yearNumber = Number(selectedYear);
    if (Number.isNaN(yearNumber)) {
      return [] as string[];
    }
    return Array.from({ length: 12 }, (_, index) => `${selectedYear}-${String(index + 1).padStart(2, '0')}`);
  }, [selectedYear]);

  const monthLookup = useMemo(() => {
    const map = new Map<string, MonthOverview>();
    monthMetadata.forEach(item => {
      map.set(item.month, item);
    });
    return map;
  }, [monthMetadata]);

  const monthItems = useMemo<MonthItem[]>(() => {
    return monthsForYear.map(monthValue => {
      const meta = monthLookup.get(monthValue);
      const status = getMonthStatus(meta);
      const sourceMeta = meta?.committedMeta ?? meta?.draftMeta;
      const sourceLabel = sourceMeta
        ? sourceMeta.sourceType === 'copy'
          ? `복사: ${sourceMeta.sourceMonth ? formatMonthLabel(sourceMeta.sourceMonth) : '출처 없음'}`
          : '템플릿으로 생성'
        : undefined;
      return {
        month: monthValue,
        label: formatMonthLabel(monthValue),
        status,
        sourceLabel,
        savedAtLabel: formatSavedAt(meta?.committedMeta?.savedAt ?? meta?.draftMeta?.savedAt),
      };
    });
  }, [monthLookup, monthsForYear]);

  const savedMonths = useMemo(() => monthItems.filter(item => item.status === 'saved'), [monthItems]);
  const availableTargets = useMemo(() => monthItems.filter(item => item.status !== 'saved'), [monthItems]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (!selectedTargetMonth || !availableTargets.some(item => item.month === selectedTargetMonth)) {
      setSelectedTargetMonth(availableTargets[0]?.month ?? null);
    }
  }, [isOpen, availableTargets, selectedTargetMonth]);

  const savedMonthOptions = useMemo(() => {
    return monthMetadata
      .filter(item => item.hasCommittedData && isMonthWithinYearRange(item.month, minAllowedYear, maxAllowedYear))
      .map(item => item.month)
      .sort();
  }, [maxAllowedYear, minAllowedYear, monthMetadata]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (creationMode !== 'copy') {
      setSelectedSourceMonth(null);
      return;
    }

    if (selectedSourceMonth && savedMonthOptions.includes(selectedSourceMonth)) {
      return;
    }

    const defaultSource = getDefaultSourceMonth(selectedTargetMonth ?? undefined);
    if (defaultSource && savedMonthOptions.includes(defaultSource)) {
      setSelectedSourceMonth(defaultSource);
      return;
    }

    const fallback = savedMonthOptions.length > 0 ? savedMonthOptions[savedMonthOptions.length - 1] : null;
    setSelectedSourceMonth(fallback);
  }, [isOpen, creationMode, selectedTargetMonth, savedMonthOptions, selectedSourceMonth, getDefaultSourceMonth]);

  useEffect(() => {
    if (!isOpen) {
      setShowResetConfirmation(false);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleTargetSelect = (month: string) => {
    if (!isMonthWithinYearRange(month, minAllowedYear, maxAllowedYear)) {
      setErrorMessage(`${minAllowedYear}년부터 ${maxAllowedYear}년까지만 선택할 수 있습니다.`);
      return;
    }
    setSelectedTargetMonth(month);
    setErrorMessage(null);
  };

  const handleCreate = () => {
    if (!selectedTargetMonth) {
      setErrorMessage('생성할 달을 선택해주세요.');
      return;
    }

    if (!isMonthWithinYearRange(selectedTargetMonth, minAllowedYear, maxAllowedYear)) {
      setErrorMessage(`${minAllowedYear}년부터 ${maxAllowedYear}년까지만 새 데이터를 준비할 수 있습니다.`);
      return;
    }

    const options = creationMode === 'copy'
      ? { mode: 'copyPrevious' as const, sourceMonth: selectedSourceMonth ?? undefined, force: true }
      : { mode: 'blank' as const, force: true };

    const success = prepareMonth(selectedTargetMonth, options);
    if (!success) {
      setErrorMessage('월 데이터를 준비하는 중 오류가 발생했습니다.');
      return;
    }

    setCurrentMonths([selectedTargetMonth, currentMonths[1]]);
    onClose();
  };

  const handleResetCurrentMonth = () => {
    if (!primaryMonth) {
      return;
    }
    if (!isMonthWithinYearRange(primaryMonth, minAllowedYear, maxAllowedYear)) {
      setShowResetConfirmation(false);
      setErrorMessage(`${minAllowedYear}년부터 ${maxAllowedYear}년까지만 초기화할 수 있습니다.`);
      return;
    }
    const success = prepareMonth(primaryMonth, { mode: 'blank', force: true });
    if (success) {
      setShowResetConfirmation(false);
      onClose();
    } else {
      setErrorMessage('현재 월 초기화에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const canCopy = savedMonthOptions.length > 0;
  const disableCreate = !selectedTargetMonth
    || !isMonthWithinYearRange(selectedTargetMonth, minAllowedYear, maxAllowedYear)
    || (creationMode === 'copy' && !canCopy);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-xl p-8" role="dialog" aria-modal="true">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">월 데이터 관리</h2>
            <p className="mt-1 text-sm text-gray-600">저장된 월과 비어 있는 월을 한눈에 확인하고 새 월 데이터를 준비하세요.</p>
          </div>
          <button
            type="button"
            className="text-gray-500 hover:text-gray-700"
            onClick={onClose}
            aria-label="모달 닫기"
          >
            ×
          </button>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <label className="text-sm font-medium text-gray-700">연도 선택</label>
          <select
            value={selectedYear}
            onChange={event => setSelectedYear(event.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            {availableYears.map(year => (
              <option key={year} value={year}>{year}년</option>
            ))}
          </select>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">저장된 달</h3>
              <span className="text-xs text-gray-500">{savedMonths.length}개</span>
            </div>
            <div className="mt-3 space-y-2 max-h-60 overflow-y-auto pr-1">
              {savedMonths.length === 0 && (
                <p className="text-sm text-gray-500">선택한 연도에 저장된 달이 없습니다.</p>
              )}
              {savedMonths.map(item => (
                <div key={item.month} className="border border-green-200 bg-green-50 rounded-lg px-3 py-2">
                  <div className="flex justify-between text-sm font-medium text-green-800">
                    <span>{item.label}</span>
                    {item.savedAtLabel && <span className="text-xs text-green-700">저장: {item.savedAtLabel}</span>}
                  </div>
                  {item.sourceLabel && <p className="mt-1 text-xs text-green-700">{item.sourceLabel}</p>}
                </div>
              ))}
            </div>
          </div>

          <div className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">데이터가 없는 달</h3>
              <span className="text-xs text-gray-500">{availableTargets.length}개</span>
            </div>
            <div className="mt-3 space-y-2 max-h-60 overflow-y-auto pr-1">
              {availableTargets.length === 0 && (
                <p className="text-sm text-gray-500">선택한 연도에서 비어 있는 달이 없습니다.</p>
              )}
              {availableTargets.map(item => (
                <button
                  key={item.month}
                  type="button"
                  onClick={() => handleTargetSelect(item.month)}
                  className={`w-full text-left border rounded-lg px-3 py-2 transition-colors ${
                    item.month === selectedTargetMonth
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                >
                  <div className="flex justify-between text-sm font-medium">
                    <span>{item.label}</span>
                    <span className="text-xs text-gray-500">
                      {item.status === 'draft' ? '작성 중' : '미작성'}
                    </span>
                  </div>
                  {item.sourceLabel && <p className="mt-1 text-xs text-gray-500">최근 기준: {item.sourceLabel}</p>}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-800">선택한 달 생성 옵션</h3>
          <p className="text-sm text-gray-600 mt-1">
            {selectedTargetMonth ? `${formatMonthLabel(selectedTargetMonth)} 데이터를 어떻게 준비할지 선택하세요.` : '달을 먼저 선택해주세요.'}
          </p>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <label className={`border rounded-xl px-4 py-3 cursor-pointer transition-colors ${creationMode === 'copy' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-400'}`}>
              <input
                type="radio"
                name="month-create-mode"
                value="copy"
                className="sr-only"
                checked={creationMode === 'copy'}
                onChange={() => setCreationMode('copy')}
                disabled={!canCopy}
              />
              <div className={`${canCopy ? 'text-gray-800' : 'text-gray-400'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">기존 달에서 복사</span>
                  {!canCopy && <span className="text-xs">저장된 달 없음</span>}
                </div>
                <p className="mt-1 text-sm">선택한 달을 기준으로 직전 혹은 원하는 달의 데이터를 복사합니다.</p>
                {creationMode === 'copy' && canCopy && (
                  <div className="mt-3">
                    <label className="text-xs font-medium text-gray-600">복사할 기준 달</label>
                    <select
                      value={selectedSourceMonth ?? ''}
                      onChange={event => setSelectedSourceMonth(event.target.value || null)}
                      className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                      {savedMonthOptions.map(monthValue => (
                        <option key={monthValue} value={monthValue}>{formatMonthLabel(monthValue)}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </label>

            <label className={`border rounded-xl px-4 py-3 cursor-pointer transition-colors ${creationMode === 'blank' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-400'}`}>
              <input
                type="radio"
                name="month-create-mode"
                value="blank"
                className="sr-only"
                checked={creationMode === 'blank'}
                onChange={() => setCreationMode('blank')}
              />
              <div className="text-gray-800">
                <span className="font-semibold">템플릿으로 새로 만들기</span>
                <p className="mt-1 text-sm">설정된 계정 템플릿과 고정비 기본값으로 빈 달을 생성합니다.</p>
              </div>
            </label>
          </div>

          {errorMessage && (
            <p className="mt-4 text-sm text-red-600">{errorMessage}</p>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <button
                type="button"
                onClick={() => setShowResetConfirmation(true)}
                className="text-sm text-gray-500 hover:text-red-600"
                disabled={!primaryMonth}
              >
                현재 월 데이터를 빈 값으로 초기화
              </button>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-100"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={disableCreate}
                className={`px-4 py-2 rounded-md text-sm font-semibold ${disableCreate ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
              >
                {creationMode === 'copy' ? '복사해서 열기' : '빈 달로 열기'}
              </button>
            </div>
          </div>
        </div>

        {showResetConfirmation && primaryMonth && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
              <h4 className="text-lg font-semibold text-gray-900">현재 월 초기화</h4>
              <p className="mt-2 text-sm text-gray-600">
                {formatMonthLabel(primaryMonth)} 데이터를 템플릿 초기값으로 재설정합니다. 이 작업은 저장되지 않은 내용을 모두 제거합니다.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowResetConfirmation(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-100"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleResetCurrentMonth}
                  className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-semibold hover:bg-red-700"
                >
                  초기화
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MonthManagementModal;


