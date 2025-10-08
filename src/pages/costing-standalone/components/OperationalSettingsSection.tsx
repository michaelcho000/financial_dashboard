import React, { useEffect, useMemo, useState } from 'react';
import {
  calculateOperationalMinutes,
  calculateWeeklyOperationalMinutes,
} from '../../../services/standaloneCosting/calculations';
import {
  DayOfWeek,
  OperationalConfig,
  OperationalScheduleMode,
  WeeklyScheduleEntry,
} from '../../../services/standaloneCosting/types';
import { useStandaloneCosting } from '../state/StandaloneCostingProvider';
import Alert from './Alert';
import HelpTooltip from './HelpTooltip';
import Modal from '../../../components/common/Modal';

interface WeeklyDayForm {
  day: DayOfWeek;
  label: string;
  isOpen: boolean;
  startTime: string;
  endTime: string;
}

interface FormState {
  mode: OperationalScheduleMode;
  simpleOperatingDays: string;
  simpleOperatingHours: string;
  bedCount: string;
  weeksPerMonth: string;
  weekly: WeeklyDayForm[];
  notes: string;
}

const DEFAULT_WEEKS_PER_MONTH = 4.345;

const DAY_LABELS: Record<DayOfWeek, string> = {
  MON: '월요일',
  TUE: '화요일',
  WED: '수요일',
  THU: '목요일',
  FRI: '금요일',
  SAT: '토요일',
  SUN: '일요일',
};

const MODE_OPTIONS: { value: OperationalScheduleMode; label: string }[] = [
  { value: 'simple', label: '월별 총량 입력' },
  { value: 'weekly', label: '요일별 스케줄 입력' },
];

const DEFAULT_START_TIME = '10:00';
const DEFAULT_END_TIME = '19:00';

const createWeeklyFormState = (entries: WeeklyScheduleEntry[]): WeeklyDayForm[] =>
  entries.map(entry => ({
    day: entry.day,
    label: DAY_LABELS[entry.day],
    isOpen: entry.isOpen,
    startTime: entry.startTime ?? DEFAULT_START_TIME,
    endTime: entry.endTime ?? DEFAULT_END_TIME,
  }));

const sanitizeNumericInput = (value: string): string => value.replace(/[^0-9.]/g, '');

const parseFloatOrNull = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const parsePositiveInt = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  const integer = Math.floor(parsed);
  return integer > 0 ? integer : null;
};

const buildFormStateFromConfig = (config: OperationalConfig): FormState => ({
  mode: config.mode,
  simpleOperatingDays:
    config.simple.operatingDays !== null && config.simple.operatingDays !== undefined
      ? String(config.simple.operatingDays)
      : '',
  simpleOperatingHours:
    config.simple.operatingHoursPerDay !== null && config.simple.operatingHoursPerDay !== undefined
      ? String(config.simple.operatingHoursPerDay)
      : '',
  bedCount: config.bedCount !== null && config.bedCount !== undefined ? String(config.bedCount) : '1',
  weeksPerMonth:
    config.weekly.weeksPerMonth !== null && config.weekly.weeksPerMonth !== undefined
      ? String(config.weekly.weeksPerMonth)
      : String(DEFAULT_WEEKS_PER_MONTH),
  weekly: createWeeklyFormState(config.weekly.schedule),
  notes: config.notes ?? '',
});

const deriveWeeklyScheduleEntries = (weeklyForm: WeeklyDayForm[]): WeeklyScheduleEntry[] =>
  weeklyForm.map(entry => ({
    day: entry.day,
    isOpen: Boolean(entry.isOpen && entry.startTime && entry.endTime && entry.endTime > entry.startTime),
    startTime: entry.startTime,
    endTime: entry.endTime,
  }));

const OperationalSettingsSection: React.FC = () => {
  const { state, setOperationalConfig } = useStandaloneCosting();
  const [form, setForm] = useState<FormState>(() => buildFormStateFromConfig(state.operational));
  const [savedAt, setSavedAt] = useState<string | null>(state.lastSavedAt ?? null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    setForm(buildFormStateFromConfig(state.operational));
  }, [state.operational]);

  useEffect(() => {
    if (state.lastSavedAt) {
      setSavedAt(state.lastSavedAt);
    }
  }, [state.lastSavedAt]);

  const capacityMinutes = useMemo(() => calculateOperationalMinutes(state.operational), [state.operational]);

  const weeklyCapacitySummary = useMemo(() => {
    if (state.operational.mode !== 'weekly') {
      return null;
    }
    const monthlyMinutes = calculateWeeklyOperationalMinutes(state.operational.weekly);
    const weeksPerMonth = state.operational.weekly.weeksPerMonth ?? DEFAULT_WEEKS_PER_MONTH;
    const weeklyMinutes = weeksPerMonth > 0 ? Math.round(monthlyMinutes / weeksPerMonth) : 0;
    const openDays = state.operational.weekly.schedule.filter(entry => entry.isOpen).length;
    return {
      monthlyMinutes,
      weeklyMinutes,
      weeksPerMonth,
      openDays,
    };
  }, [state.operational]);

  const openModal = () => {
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleModeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    if (value === 'simple' || value === 'weekly') {
      setForm(prev => ({ ...prev, mode: value }));
    }
  };

  const handleSimpleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    const sanitized = sanitizeNumericInput(value);
    setForm(prev => ({
      ...prev,
      [name === 'simpleOperatingDays' ? 'simpleOperatingDays' : 'simpleOperatingHours']: sanitized,
    }));
  };

  const handleBedCountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, bedCount: event.target.value.replace(/[^0-9]/g, '') }));
  };

  const handleWeeksPerMonthChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, weeksPerMonth: sanitizeNumericInput(event.target.value) }));
  };

  const handleWeeklyToggle = (day: DayOfWeek) => {
    setForm(prev => ({
      ...prev,
      weekly: prev.weekly.map(entry =>
        entry.day === day ? { ...entry, isOpen: !entry.isOpen } : entry,
      ),
    }));
  };

  const handleWeeklyTimeChange = (day: DayOfWeek, field: 'startTime' | 'endTime', value: string) => {
    setForm(prev => ({
      ...prev,
      weekly: prev.weekly.map(entry => (entry.day === day ? { ...entry, [field]: value } : entry)),
    }));
  };

  const handleNotesChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, notes: event.target.value }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const operatingDaysValue = parseFloatOrNull(form.simpleOperatingDays);
    const operatingHoursValue = parseFloatOrNull(form.simpleOperatingHours);
    const bedCountValue = parsePositiveInt(form.bedCount);
    const weeksPerMonthValue = parseFloatOrNull(form.weeksPerMonth);

    const weeklySchedule = deriveWeeklyScheduleEntries(form.weekly);

    setOperationalConfig({
      mode: form.mode,
      simple: {
        operatingDays:
          typeof operatingDaysValue === 'number' && Number.isFinite(operatingDaysValue) ? operatingDaysValue : null,
        operatingHoursPerDay:
          typeof operatingHoursValue === 'number' && Number.isFinite(operatingHoursValue) ? operatingHoursValue : null,
      },
      weekly: {
        schedule: weeklySchedule,
        weeksPerMonth:
          typeof weeksPerMonthValue === 'number' && Number.isFinite(weeksPerMonthValue) && weeksPerMonthValue > 0
            ? weeksPerMonthValue
            : null,
      },
      bedCount:
        typeof bedCountValue === 'number' && Number.isFinite(bedCountValue) && bedCountValue > 0
          ? bedCountValue
          : 1,
      notes: form.notes.trim() || undefined,
    });

    setSavedAt(new Date().toISOString());
    setIsModalOpen(false);
  };

  const weeklyRows = state.operational.weekly.schedule;

  return (
    <>
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">운영 세팅</h2>
            <p className="mt-1 text-sm text-gray-600">월 가용 시간을 정의합니다.</p>
          </div>
          <button
            onClick={openModal}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            ⚙️ 수정
          </button>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">운영 모드</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {form.mode === 'weekly' ? '요일별 스케줄' : '월별 총량'}
            </p>
            {savedAt && (
              <p className="mt-1 text-xs text-gray-500">
                마지막 저장: {new Date(savedAt).toLocaleString('ko-KR')}
              </p>
            )}
          </div>

          <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">동시 운영 베드 수</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{state.operational.bedCount ?? '-'}대</p>
          </div>

          {state.operational.mode === 'simple' ? (
            <>
              <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-sm text-gray-500">월 영업일수</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {state.operational.simple.operatingDays ?? '-'}일
                </p>
              </div>
              <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-sm text-gray-500">일 영업시간</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {state.operational.simple.operatingHoursPerDay ?? '-'}시간
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-sm text-gray-500">주간 영업일</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {weeklyCapacitySummary?.openDays ?? 0}일/주
                </p>
              </div>
              <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-sm text-gray-500">주간 총 영업시간</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {weeklyCapacitySummary
                    ? `${Math.round((weeklyCapacitySummary.weeklyMinutes ?? 0) / 60)}시간`
                    : '-'}
                </p>
                {weeklyCapacitySummary && (
                  <p className="mt-1 text-xs text-gray-500">
                    월 평균 {weeklyCapacitySummary.weeksPerMonth.toFixed(3)}주 기준
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {state.operational.mode === 'weekly' && (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">요일</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">진료 여부</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">운영 시간</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {weeklyRows.map(row => (
                  <tr key={row.day}>
                    <td className="px-4 py-2 text-sm text-gray-700">{DAY_LABELS[row.day]}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{row.isOpen ? '진료' : '휴무'}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">
                      {row.isOpen && row.startTime && row.endTime ? `${row.startTime} ~ ${row.endTime}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {state.operational.notes && (
          <div className="mt-3 max-w-2xl">
            <p className="text-xs text-gray-500">메모</p>
            <p className="mt-1 text-sm text-gray-700 whitespace-pre-line">{state.operational.notes}</p>
          </div>
        )}

        {capacityMinutes === 0 && (
          <div className="mt-4">
            <Alert variant="warning" title="운영 세팅이 설정되지 않았습니다">
              <p>
                월 가용 시간이 0분으로 계산되었습니다. 운영 모드, 시간을 확인하고 동시 운영 가능한 베드 수까지 입력해야
                고정비 배분이 정확히 이뤄집니다.
              </p>
            </Alert>
          </div>
        )}

        {capacityMinutes > 0 && (
          <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-4 max-w-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-800">월 가용 시간</p>
                <p className="mt-1 text-xl font-bold text-green-900">{capacityMinutes.toLocaleString('ko-KR')}분</p>
              </div>
              <HelpTooltip content="이 값을 기준으로 고정비가 시술별로 배분됩니다." />
            </div>
            <p className="mt-2 text-xs text-green-700">
              고정비 분당 배분율 = 월 시설·운영비 / {capacityMinutes.toLocaleString('ko-KR')}분 (베드 수 포함)
            </p>
          </div>
        )}
      </section>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title="운영 세팅 수정"
        size="lg"
        footer={
          <>
            <button
              onClick={closeModal}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              저장
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900">운영 방식 선택</legend>
            <div className="mt-2 flex gap-6">
              {MODE_OPTIONS.map(option => (
                <label key={option.value} className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="mode"
                    value={option.value}
                    checked={form.mode === option.value}
                    onChange={handleModeChange}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          {form.mode === 'simple' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                월 영업일수
                <input
                  name="simpleOperatingDays"
                  type="number"
                  min={0}
                  value={form.simpleOperatingDays}
                  onChange={handleSimpleChange}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="예: 26"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                1일 영업시간 (시간)
                <input
                  name="simpleOperatingHours"
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.simpleOperatingHours}
                  onChange={handleSimpleChange}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="예: 10"
                />
              </label>
            </div>
          )}

          {form.mode === 'weekly' && (
            <div className="space-y-4">
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                월 평균 주 수
                <input
              name="weeksPerMonth"
              type="number"
              min={1}
              step={0.001}
              value={form.weeksPerMonth}
              onChange={handleWeeksPerMonthChange}
              className="max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="예: 4.345"
                />
                <span className="text-xs text-gray-500">기본값은 1년 365일 기준 월 평균 4.345주입니다.</span>
              </label>

              <div className="overflow-x-auto rounded-md border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">요일</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">진료</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">시작</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">종료</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {form.weekly.map(entry => (
                      <tr key={entry.day}>
                        <td className="px-4 py-2 text-sm text-gray-700">{entry.label}</td>
                        <td className="px-4 py-2">
                          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={entry.isOpen}
                              onChange={() => handleWeeklyToggle(entry.day)}
                            />
                            진료
                          </label>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="time"
                            value={entry.startTime}
                            onChange={event => handleWeeklyTimeChange(entry.day, 'startTime', event.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            disabled={!entry.isOpen}
                            step={300}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="time"
                            value={entry.endTime}
                            onChange={event => handleWeeklyTimeChange(entry.day, 'endTime', event.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            disabled={!entry.isOpen}
                            step={300}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              동시 운영 베드 수
              <input
                name="bedCount"
                type="number"
                min={1}
                step={1}
                value={form.bedCount}
                onChange={handleBedCountChange}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="예: 4"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            메모
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleNotesChange}
              rows={3}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="운영 시간 비고를 입력하세요."
            />
          </label>
        </form>
      </Modal>
    </>
  );
};

export default OperationalSettingsSection;
