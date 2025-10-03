import React, { useEffect, useMemo, useState } from 'react';
import { calculateOperationalMinutes } from '../../../services/standaloneCosting/calculations';
import { useStandaloneCosting } from '../state/StandaloneCostingProvider';
import Alert from './Alert';
import HelpTooltip from './HelpTooltip';

interface FormState {
  operatingDays: string;
  operatingHoursPerDay: string;
  notes: string;
}

const OperationalSettingsSection: React.FC = () => {
  const { state, setOperationalConfig } = useStandaloneCosting();
  const [form, setForm] = useState<FormState>({ operatingDays: '', operatingHoursPerDay: '', notes: '' });
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    const { operatingDays, operatingHoursPerDay, notes } = state.operational;
    setForm({
      operatingDays: operatingDays !== null && operatingDays !== undefined ? String(operatingDays) : '',
      operatingHoursPerDay:
        operatingHoursPerDay !== null && operatingHoursPerDay !== undefined ? String(operatingHoursPerDay) : '',
      notes: notes ?? '',
    });
  }, [state.operational]);

  useEffect(() => {
    if (state.lastSavedAt) {
      setSavedAt(state.lastSavedAt);
    }
  }, [state.lastSavedAt]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const operatingDaysValue = form.operatingDays.trim() ? Number(form.operatingDays) : null;
    const operatingHoursValue = form.operatingHoursPerDay.trim() ? Number(form.operatingHoursPerDay) : null;

    setOperationalConfig({
      operatingDays:
        typeof operatingDaysValue === 'number' && Number.isFinite(operatingDaysValue) ? operatingDaysValue : null,
      operatingHoursPerDay:
        typeof operatingHoursValue === 'number' && Number.isFinite(operatingHoursValue) ? operatingHoursValue : null,
      notes: form.notes.trim() || undefined,
    });
    setSavedAt(new Date().toISOString());
  };

  const capacityMinutes = useMemo(() => calculateOperationalMinutes(state.operational), [state.operational]);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">운영 세팅</h2>
          <p className="mt-1 text-sm text-gray-600">영업일과 영업시간을 입력해 월 가용 시간을 정의합니다.</p>
        </div>
        {savedAt && <span className="text-xs text-gray-400">최근 저장: {new Date(savedAt).toLocaleString('ko-KR')}</span>}
      </header>

      <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          월 영업일수
          <input
            name="operatingDays"
            type="number"
            min={0}
            value={form.operatingDays}
            onChange={handleChange}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            placeholder="예: 26"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-gray-700">
          1일 영업시간 (시간)
          <input
            name="operatingHoursPerDay"
            type="number"
            min={0}
            step={0.5}
            value={form.operatingHoursPerDay}
            onChange={handleChange}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            placeholder="예: 10"
          />
        </label>

        <label className="md:col-span-2 flex flex-col gap-1 text-sm text-gray-700">
          메모
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={3}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            placeholder="운영 시간 비고를 입력하세요."
          />
        </label>

        <div className="md:col-span-2 flex justify-end">
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            저장
          </button>
        </div>
      </form>

      {/* 경고 UI (capacityMinutes === 0일 때만 표시) */}
      {capacityMinutes === 0 && (
        <div className="mt-4">
          <Alert variant="warning" title="운영 세팅이 설정되지 않았습니다">
            <p>
              월 영업일수와 1일 영업시간을 입력해야 고정비 배분이 계산됩니다.
              현재는 고정비가 시술 원가에 반영되지 않습니다.
            </p>
          </Alert>
        </div>
      )}

      {/* 계산 결과 표시 (capacityMinutes > 0일 때) */}
      {capacityMinutes > 0 && (
        <div className="mt-4 rounded-md border border-blue-100 bg-blue-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-blue-800">
              월 가용 시간: <strong>{capacityMinutes.toLocaleString('ko-KR')}분</strong>
            </p>
            <HelpTooltip content="이 값을 기준으로 고정비가 시술별로 배분됩니다." />
          </div>
          <p className="mt-1 text-xs text-blue-700">
            고정비 분당 배분율 = 월 시설·운영비 / {capacityMinutes.toLocaleString('ko-KR')}분
          </p>
        </div>
      )}
    </section>
  );
};

export default OperationalSettingsSection;
