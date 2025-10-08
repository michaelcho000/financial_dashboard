import React, { useMemo, useState } from 'react';
import { analyzeWeeklySchedule, calculateStaffMinuteRate } from '../../../services/standaloneCosting/calculations';
import { StaffProfile, StaffWorkPattern } from '../../../services/standaloneCosting/types';
import { useStandaloneCosting } from '../state/StandaloneCostingProvider';
import { formatKrw, formatNumberInput, parseNumberInput } from '../../../utils/formatters';
import { generateId } from '../../../utils/id';
import Modal from '../../../components/common/Modal';
import PhaseSaveControls from './PhaseSaveControls';

const MINUTES_IN_HOUR = 60;
const DEFAULT_WEEKS_PER_MONTH = 4.345;

const BASIS_OPTIONS = [
  { value: 'monthly', label: '월 단위 입력' },
  { value: 'weekly', label: '주 단위 입력' },
  { value: 'daily', label: '요일 기준 입력' },
] as const;

type WorkBasis = (typeof BASIS_OPTIONS)[number]['value'];

interface StaffFormState {
  id: string | null;
  name: string;
  role: string;
  monthlySalary: string;
  basis: WorkBasis;
  monthlyDays: string;
  monthlyHoursPerDay: string;
  weeklyDays: string;
  weeklyHours: string;
  weeklyHoursPerDay: string;
  dailyDays: string;
  dailyHours: string;
  notes: string;
}

const emptyForm: StaffFormState = {
  id: null,
  name: '',
  role: '',
  monthlySalary: '',
  basis: 'monthly',
  monthlyDays: '',
  monthlyHoursPerDay: '',
  weeklyDays: '',
  weeklyHours: '',
  weeklyHoursPerDay: '',
  dailyDays: '',
  dailyHours: '',
  notes: '',
};

const toNumber = (value: string): number | null => {
  if (!value.trim()) {
    return null;
  }
  const normalized = Number(value.replace(/,/g, ''));
  return Number.isFinite(normalized) ? normalized : null;
};

const computeEffectiveWeeks = (
  workPatternMode: 'simple' | 'weekly',
  weeklyScheduleAnalysis: ReturnType<typeof analyzeWeeklySchedule> | null,
  simpleOperatingDays: number | null,
): number => {
  if (workPatternMode === 'weekly' && weeklyScheduleAnalysis) {
    if (
      weeklyScheduleAnalysis.isCalendarExact &&
      weeklyScheduleAnalysis.weeklyPatternMinutes > 0 &&
      weeklyScheduleAnalysis.monthlyMinutesPerBed > 0
    ) {
      const exactWeeks = weeklyScheduleAnalysis.monthlyMinutesPerBed / weeklyScheduleAnalysis.weeklyPatternMinutes;
      if (Number.isFinite(exactWeeks) && exactWeeks > 0) {
        return exactWeeks;
      }
    }
    if (
      weeklyScheduleAnalysis.effectiveWeeks &&
      Number.isFinite(weeklyScheduleAnalysis.effectiveWeeks) &&
      weeklyScheduleAnalysis.effectiveWeeks > 0
    ) {
      return weeklyScheduleAnalysis.effectiveWeeks;
    }
  }

  if (workPatternMode === 'simple' && simpleOperatingDays && Number.isFinite(simpleOperatingDays) && simpleOperatingDays > 0) {
    const weeks = simpleOperatingDays / 7;
    if (Number.isFinite(weeks) && weeks > 0) {
      return weeks;
    }
  }

  return DEFAULT_WEEKS_PER_MONTH;
};

const computeDerivedPreview = (form: StaffFormState, effectiveWeeks: number) => {
  const safeWeeks = effectiveWeeks > 0 ? effectiveWeeks : DEFAULT_WEEKS_PER_MONTH;
  let weeklyHours = 0;
  let weeklyMinutes = 0;
  let monthlyMinutes = 0;

  if (form.basis === 'monthly') {
    const days = toNumber(form.monthlyDays) ?? 0;
    const hoursPerDay = toNumber(form.monthlyHoursPerDay) ?? 0;
    monthlyMinutes = days * hoursPerDay * MINUTES_IN_HOUR;
    weeklyMinutes = safeWeeks > 0 ? monthlyMinutes / safeWeeks : 0;
    weeklyHours = weeklyMinutes / MINUTES_IN_HOUR;
  } else if (form.basis === 'weekly') {
    const weeklyDays = toNumber(form.weeklyDays) ?? 0;
    const hoursPerWeek = toNumber(form.weeklyHours);
    const hoursPerDay = toNumber(form.weeklyHoursPerDay);
    const resolvedWeeklyHours =
      hoursPerWeek ??
      (weeklyDays > 0 && hoursPerDay !== null ? hoursPerDay * weeklyDays : null);
    weeklyHours = resolvedWeeklyHours ?? 0;
    weeklyMinutes = weeklyHours * MINUTES_IN_HOUR;
    monthlyMinutes = weeklyMinutes * safeWeeks;
  } else {
    const dailyDays = toNumber(form.dailyDays) ?? 0;
    const hoursPerDay = toNumber(form.dailyHours) ?? 0;
    weeklyHours = dailyDays * hoursPerDay;
    weeklyMinutes = weeklyHours * MINUTES_IN_HOUR;
    monthlyMinutes = weeklyMinutes * safeWeeks;
  }

  const monthlyHours = monthlyMinutes / MINUTES_IN_HOUR;

  return {
    weeklyHours,
    weeklyMinutes,
    monthlyHours,
    monthlyMinutes,
  };
};

const buildWorkPattern = (
  form: StaffFormState,
  effectiveWeeks: number,
  derived: ReturnType<typeof computeDerivedPreview>,
): { pattern: StaffWorkPattern; workDaysPerMonth: number; workHoursPerDay: number } => {
  const safeWeeks = effectiveWeeks > 0 ? effectiveWeeks : DEFAULT_WEEKS_PER_MONTH;
  const derivedMonthlyMinutes = Math.max(0, Math.round(derived.monthlyMinutes));
  const derivedWeeklyMinutes = derived.weeklyMinutes > 0 ? derived.weeklyMinutes : null;

  if (form.basis === 'monthly') {
    const days = toNumber(form.monthlyDays) ?? 0;
    const hoursPerDay = toNumber(form.monthlyHoursPerDay) ?? 0;
    return {
      pattern: {
        basis: 'monthly',
        monthly: days > 0 && hoursPerDay > 0 ? { workDaysPerMonth: days, workHoursPerDay: hoursPerDay } : null,
        weekly: null,
        daily: null,
        effectiveWeeksPerMonth: safeWeeks,
        derivedMonthlyMinutes,
        derivedWeeklyMinutes,
      },
      workDaysPerMonth: days,
      workHoursPerDay: hoursPerDay,
    };
  }

  if (form.basis === 'weekly') {
    const weeklyDays = toNumber(form.weeklyDays) ?? 0;
    const weeklyHours = toNumber(form.weeklyHours);
    const weeklyHoursPerDay = toNumber(form.weeklyHoursPerDay);
    const approxDailyHours =
      weeklyHoursPerDay ??
      (weeklyHours !== null && weeklyDays > 0 ? weeklyHours / weeklyDays : 0);
    return {
      pattern: {
        basis: 'weekly',
        monthly: null,
        weekly: {
          workDaysPerWeek: weeklyDays,
          workHoursPerWeek: weeklyHours,
          workHoursPerDay: weeklyHoursPerDay,
        },
        daily: null,
        effectiveWeeksPerMonth: safeWeeks,
        derivedMonthlyMinutes,
        derivedWeeklyMinutes,
      },
      workDaysPerMonth: weeklyDays > 0 ? weeklyDays * safeWeeks : 0,
      workHoursPerDay: approxDailyHours ?? 0,
    };
  }

  const dailyDays = toNumber(form.dailyDays) ?? 0;
  const dailyHours = toNumber(form.dailyHours) ?? 0;
  return {
    pattern: {
      basis: 'daily',
      monthly: null,
      weekly: null,
      daily: {
        workDaysPerWeek: dailyDays,
        workHoursPerDay: dailyHours,
      },
      effectiveWeeksPerMonth: safeWeeks,
      derivedMonthlyMinutes,
      derivedWeeklyMinutes,
    },
    workDaysPerMonth: dailyDays > 0 ? dailyDays * safeWeeks : 0,
    workHoursPerDay: dailyHours,
  };
};

const formatPatternSummary = (pattern: StaffWorkPattern | null | undefined): string => {
  if (!pattern) {
    return '-';
  }

  if (pattern.basis === 'monthly' && pattern.monthly) {
    const days = pattern.monthly.workDaysPerMonth;
    const hours = pattern.monthly.workHoursPerDay;
    if (days && hours) {
      return `월 ${days}일 · ${hours}시간`;
    }
    return '월 기준';
  }

  if (pattern.basis === 'weekly' && pattern.weekly) {
    const days = pattern.weekly.workDaysPerWeek;
    const hoursWeek = pattern.weekly.workHoursPerWeek;
    const hoursDay = pattern.weekly.workHoursPerDay;
    if (hoursWeek && days) {
      return `주 ${days}일 · ${hoursWeek}시간`;
    }
    if (days && hoursDay) {
      return `주 ${days}일 · 일 ${hoursDay}시간`;
    }
    if (hoursWeek) {
      return `주 ${hoursWeek}시간`;
    }
    if (days) {
      return `주 ${days}일`;
    }
    return '주 기준';
  }

  if (pattern.basis === 'daily' && pattern.daily) {
    const days = pattern.daily.workDaysPerWeek;
    const hours = pattern.daily.workHoursPerDay;
    if (days && hours) {
      return `주 ${days}일 · 일 ${hours}시간`;
    }
    if (days) {
      return `주 ${days}일`;
    }
    if (hours) {
      return `일 ${hours}시간`;
    }
    return '요일 기준';
  }

  return '-';
};

const mapStaffToForm = (staff: StaffProfile): StaffFormState => {
  const pattern = staff.workPattern ?? null;
  const basis: WorkBasis = pattern?.basis ?? 'monthly';
  const monthlyDays =
    pattern?.monthly?.workDaysPerMonth ??
    (staff.workDaysPerMonth ? String(staff.workDaysPerMonth) : '');
  const monthlyHours =
    pattern?.monthly?.workHoursPerDay ??
    (staff.workHoursPerDay ? String(staff.workHoursPerDay) : '');

  const weeklyDays =
    pattern?.weekly?.workDaysPerWeek ??
    pattern?.daily?.workDaysPerWeek ??
    '';
  const weeklyHours =
    pattern?.weekly?.workHoursPerWeek ??
    (pattern?.weekly?.workHoursPerDay && weeklyDays
      ? pattern.weekly.workHoursPerDay * weeklyDays
      : null);
  const weeklyHoursPerDay =
    pattern?.weekly?.workHoursPerDay ?? null;

  const dailyDays =
    pattern?.daily?.workDaysPerWeek ??
    pattern?.weekly?.workDaysPerWeek ??
    '';
  const dailyHours =
    pattern?.daily?.workHoursPerDay ??
    pattern?.weekly?.workHoursPerDay ??
    '';

  return {
    id: staff.id,
    name: staff.name,
    role: staff.role,
    monthlySalary: String(staff.monthlySalary ?? ''),
    basis,
    monthlyDays: monthlyDays !== '' ? String(monthlyDays) : '',
    monthlyHoursPerDay: monthlyHours !== '' ? String(monthlyHours) : '',
    weeklyDays: weeklyDays !== '' ? String(weeklyDays) : '',
    weeklyHours: weeklyHours !== null ? String(weeklyHours) : '',
    weeklyHoursPerDay: weeklyHoursPerDay !== null ? String(weeklyHoursPerDay) : '',
    dailyDays: dailyDays !== '' ? String(dailyDays) : '',
    dailyHours: dailyHours !== '' ? String(dailyHours) : '',
    notes: staff.notes ?? '',
  };
};

const StaffManagementSection: React.FC = () => {
  const { state, upsertStaff, removeStaff } = useStandaloneCosting();
  const [form, setForm] = useState<StaffFormState>(emptyForm);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const weeklyAnalysis = useMemo(() => {
    if (state.operational.mode === 'weekly') {
      return analyzeWeeklySchedule(state.operational.weekly);
    }
    return null;
  }, [state.operational]);

  const effectiveWeeks = useMemo(
    () =>
      computeEffectiveWeeks(
        state.operational.mode,
        weeklyAnalysis,
        state.operational.simple.operatingDays,
      ),
    [state.operational.mode, state.operational.simple.operatingDays, weeklyAnalysis],
  );

  const derivedPreview = useMemo(() => computeDerivedPreview(form, effectiveWeeks), [form, effectiveWeeks]);
  const monthlySalaryValue = toNumber(form.monthlySalary) ?? 0;
  const previewMinuteRate =
    derivedPreview.monthlyMinutes > 0 ? monthlySalaryValue / derivedPreview.monthlyMinutes : 0;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    if (name === 'monthlySalary') {
      setForm(prev => ({ ...prev, [name]: parseNumberInput(value) }));
      return;
    }
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleBasisChange = (basis: WorkBasis) => {
    setForm(prev => ({ ...prev, basis }));
  };

  const resetForm = () => {
    setForm(emptyForm);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const derived = computeDerivedPreview(form, effectiveWeeks);
    const { pattern, workDaysPerMonth, workHoursPerDay } = buildWorkPattern(form, effectiveWeeks, derived);

    const payload: StaffProfile = {
      id: form.id ?? generateId(),
      name: form.name.trim(),
      role: form.role.trim(),
      monthlySalary: monthlySalaryValue,
      workDaysPerMonth,
      workHoursPerDay,
      workPattern: pattern,
      notes: form.notes.trim() || undefined,
    };

    upsertStaff(payload);
    resetForm();
    setIsModalOpen(false);
  };

  const openModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleEdit = (staff: StaffProfile) => {
    setForm(mapStaffToForm(staff));
    setIsModalOpen(true);
  };

  const handleDelete = (staff: StaffProfile) => {
    const confirmed = window.confirm(
      `${staff.name} (${staff.role}) 인력 정보를 삭제하시겠습니까? 연결된 시술에서 제거됩니다.`,
    );
    if (confirmed) {
      removeStaff(staff.id);
      if (form.id === staff.id) {
        resetForm();
      }
    }
  };

  const staffWithDerived = useMemo(
    () =>
      state.staff.map(item => {
        const monthlyMinutes =
          item.workPattern?.derivedMonthlyMinutes ??
          item.workDaysPerMonth * item.workHoursPerDay * MINUTES_IN_HOUR;
        return {
          ...item,
          minuteRate: calculateStaffMinuteRate(item),
          monthlyMinutes,
          patternSummary: formatPatternSummary(item.workPattern),
        };
      }),
    [state.staff],
  );

  return (
    <>
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">인력 관리</h2>
            <p className="mt-1 text-sm text-gray-600">의사, 간호사 등 역할별 급여와 근무 시간을 등록합니다.</p>
          </div>
          <button
            onClick={openModal}
            className="rounded-md border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            + 인력 추가
          </button>
        </header>

        <PhaseSaveControls phaseId="staff" className="mb-4" />

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">이름</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">역할</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">월 급여 (원)</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">근무 패턴</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">월 근무 시간 (분)</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">분당 인건비 (원/분)</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">메모</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {staffWithDerived.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-400" colSpan={8}>
                    등록된 인력이 없습니다.
                  </td>
                </tr>
              ) : (
                staffWithDerived.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900">{item.name}</td>
                    <td className="px-4 py-2 text-gray-600">{item.role}</td>
                    <td className="px-4 py-2 text-right text-gray-900">{formatKrw(item.monthlySalary)}</td>
                    <td className="px-4 py-2 text-gray-600">{item.patternSummary}</td>
                    <td className="px-4 py-2 text-right text-gray-600">
                      {item.monthlyMinutes > 0 ? `${item.monthlyMinutes.toLocaleString('ko-KR')}분` : '-'}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-900">{formatKrw(item.minuteRate)}</td>
                    <td className="px-4 py-2 text-gray-600">{item.notes || '-'}</td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(item)}
                          className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-100"
                        >
                          편집
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          className="rounded-md border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={form.id ? '인력 정보 수정' : '인력 추가'}
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              이름
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-gray-700">
              역할
              <input
                name="role"
                value={form.role}
                onChange={handleChange}
                placeholder="예: 의사, 간호사"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            월 급여 (원)
            <input
              name="monthlySalary"
              type="text"
              inputMode="numeric"
              value={formatNumberInput(form.monthlySalary)}
              onChange={handleChange}
              placeholder="예: 4,500,000"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">근무 패턴 입력 방식</p>
            <div className="flex flex-wrap gap-2">
              {BASIS_OPTIONS.map(option => {
                const isActive = form.basis === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleBasisChange(option.value)}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                      isActive
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {form.basis === 'monthly' && (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                월 근무일수
                <input
                  name="monthlyDays"
                  value={form.monthlyDays}
                  onChange={handleChange}
                  placeholder="예: 22"
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                일 근무시간
                <input
                  name="monthlyHoursPerDay"
                  value={form.monthlyHoursPerDay}
                  onChange={handleChange}
                  placeholder="예: 8"
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>
          )}

          {form.basis === 'weekly' && (
            <div className="grid gap-4 md:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                주 근무일수
                <input
                  name="weeklyDays"
                  value={form.weeklyDays}
                  onChange={handleChange}
                  placeholder="예: 5"
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                주 근무시간
                <input
                  name="weeklyHours"
                  value={form.weeklyHours}
                  onChange={handleChange}
                  placeholder="예: 40"
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                일 근무시간 (선택)
                <input
                  name="weeklyHoursPerDay"
                  value={form.weeklyHoursPerDay}
                  onChange={handleChange}
                  placeholder="예: 8"
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>
          )}

  {form.basis === 'daily' && (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                주 근무일수
                <input
                  name="dailyDays"
                  value={form.dailyDays}
                  onChange={handleChange}
                  placeholder="예: 6"
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                일 근무시간
                <input
                  name="dailyHours"
                  value={form.dailyHours}
                  onChange={handleChange}
                  placeholder="예: 6"
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>
          )}

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            메모 (선택)
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={3}
              placeholder="비고 사항을 입력하세요."
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs text-gray-500">월 근무시간</p>
              <p className="mt-1 text-base font-semibold text-gray-900">
                {derivedPreview.monthlyHours > 0 ? `${Math.round(derivedPreview.monthlyHours).toLocaleString('ko-KR')}시간` : '-'}
              </p>
            </div>
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs text-gray-500">주 근무시간</p>
              <p className="mt-1 text-base font-semibold text-gray-900">
                {derivedPreview.weeklyHours > 0 ? `${Math.round(derivedPreview.weeklyHours).toLocaleString('ko-KR')}시간` : '-'}
              </p>
            </div>
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs text-gray-500">예상 분당 인건비</p>
              <p className="mt-1 text-base font-semibold text-gray-900">
                {previewMinuteRate > 0 ? formatKrw(Math.round(previewMinuteRate)) : '-'}
              </p>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default StaffManagementSection;
