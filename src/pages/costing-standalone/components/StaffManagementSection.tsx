import React, { useMemo, useState } from 'react';
import { calculateStaffMinuteRate } from '../../../services/standaloneCosting/calculations';
import { StaffProfile } from '../../../services/standaloneCosting/types';
import { useStandaloneCosting } from '../state/StandaloneCostingProvider';
import { formatKrw } from '../../../utils/formatters';
import { generateId } from '../../../utils/id';

interface StaffFormState {
  id: string | null;
  name: string;
  role: string;
  monthlySalary: string;
  workDaysPerMonth: string;
  workHoursPerDay: string;
  notes: string;
}

const emptyForm: StaffFormState = {
  id: null,
  name: '',
  role: '',
  monthlySalary: '',
  workDaysPerMonth: '',
  workHoursPerDay: '',
  notes: '',
};

const toNumber = (value: string): number | null => {
  if (!value.trim()) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const StaffManagementSection: React.FC = () => {
  const { state, upsertStaff, removeStaff } = useStandaloneCosting();
  const [form, setForm] = useState<StaffFormState>(emptyForm);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload: StaffProfile = {
      id: form.id ?? generateId(),
      name: form.name.trim(),
      role: form.role.trim(),
      monthlySalary: toNumber(form.monthlySalary) ?? 0,
      workDaysPerMonth: toNumber(form.workDaysPerMonth) ?? 0,
      workHoursPerDay: toNumber(form.workHoursPerDay) ?? 0,
      notes: form.notes.trim() || undefined,
    };

    upsertStaff(payload);
    resetForm();
  };

  const handleEdit = (staff: StaffProfile) => {
    setForm({
      id: staff.id,
      name: staff.name,
      role: staff.role,
      monthlySalary: String(staff.monthlySalary ?? ''),
      workDaysPerMonth: String(staff.workDaysPerMonth ?? ''),
      workHoursPerDay: String(staff.workHoursPerDay ?? ''),
      notes: staff.notes ?? '',
    });
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
      state.staff.map(item => ({
        ...item,
        minuteRate: calculateStaffMinuteRate(item),
        monthlyMinutes: item.workDaysPerMonth * item.workHoursPerDay * 60,
      })),
    [state.staff],
  );

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">2. 인력 관리</h2>
          <p className="mt-1 text-sm text-gray-600">의사, 간호사 등 역할별 급여와 근무 시간을 등록합니다.</p>
        </div>
        <button
          type="button"
          onClick={resetForm}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
        >
          새 인력 추가
        </button>
      </header>

      <form className="grid gap-4 md:grid-cols-3" onSubmit={handleSubmit}>
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

        <label className="flex flex-col gap-1 text-sm text-gray-700">
          월 급여 (원)
          <input
            name="monthlySalary"
            type="number"
            min={0}
            value={form.monthlySalary}
            onChange={handleChange}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-gray-700">
          월 근무일
          <input
            name="workDaysPerMonth"
            type="number"
            min={0}
            value={form.workDaysPerMonth}
            onChange={handleChange}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-gray-700">
          1일 근무시간 (시간)
          <input
            name="workHoursPerDay"
            type="number"
            min={0}
            step={0.5}
            value={form.workHoursPerDay}
            onChange={handleChange}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <label className="md:col-span-3 flex flex-col gap-1 text-sm text-gray-700">
          메모
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={2}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <div className="md:col-span-3 flex justify-end gap-2">
          {form.id && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
            >
              취소
            </button>
          )}
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {form.id ? '변경 저장' : '인력 추가'}
          </button>
        </div>
      </form>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">이름</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">역할</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500">월 급여</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500">월 근무 분</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500">분당 인건비</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">메모</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {staffWithDerived.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-gray-400" colSpan={7}>
                  등록된 인력이 없습니다.
                </td>
              </tr>
            ) : (
              staffWithDerived.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{item.name}</td>
                  <td className="px-4 py-2 text-gray-600">{item.role}</td>
                  <td className="px-4 py-2 text-right text-gray-900">{formatKrw(item.monthlySalary)}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{item.monthlyMinutes.toLocaleString('ko-KR')}분</td>
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
  );
};

export default StaffManagementSection;
