import React, { useEffect, useMemo, useState } from 'react';
import { calculateOperationalMinutes } from '../../../services/standaloneCosting/calculations';
import { useStandaloneCosting } from '../state/StandaloneCostingProvider';
import Alert from './Alert';
import HelpTooltip from './HelpTooltip';
import Modal from '../../../components/common/Modal';

interface FormState {
  operatingDays: string;
  operatingHoursPerDay: string;
  bedCount: string;
  notes: string;
}

const OperationalSettingsSection: React.FC = () => {
  const { state, setOperationalConfig } = useStandaloneCosting();
  const [form, setForm] = useState<FormState>({ operatingDays: '', operatingHoursPerDay: '', bedCount: '', notes: '' });
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const { operatingDays, operatingHoursPerDay, bedCount, notes } = state.operational;
    setForm({
      operatingDays: operatingDays !== null && operatingDays !== undefined ? String(operatingDays) : '',
      operatingHoursPerDay:
        operatingHoursPerDay !== null && operatingHoursPerDay !== undefined ? String(operatingHoursPerDay) : '',
      bedCount: bedCount !== null && bedCount !== undefined ? String(bedCount) : '',
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
    const bedCountValue = form.bedCount.trim() ? Number(form.bedCount) : null;

    setOperationalConfig({
      operatingDays:
        typeof operatingDaysValue === 'number' && Number.isFinite(operatingDaysValue) ? operatingDaysValue : null,
      operatingHoursPerDay:
        typeof operatingHoursValue === 'number' && Number.isFinite(operatingHoursValue) ? operatingHoursValue : null,
      bedCount:
        typeof bedCountValue === 'number' && Number.isFinite(bedCountValue) && bedCountValue > 0
          ? Math.floor(bedCountValue)
          : 1,
      notes: form.notes.trim() || undefined,
    });
    setSavedAt(new Date().toISOString());
    setIsModalOpen(false);
  };

  const openModal = () => {
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const capacityMinutes = useMemo(() => calculateOperationalMinutes(state.operational), [state.operational]);

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

        {/* 현재 설정 요약 */}
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 max-w-3xl">
          <div className="rounded-md border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm text-blue-800">월 영업일수</p>
            <p className="mt-1 text-2xl font-bold text-blue-900">
              {state.operational.operatingDays ?? '-'}일
            </p>
          </div>
          <div className="rounded-md border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm text-blue-800">일 영업시간</p>
            <p className="mt-1 text-2xl font-bold text-blue-900">
              {state.operational.operatingHoursPerDay ?? '-'}시간
            </p>
          </div>
          <div className="rounded-md border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm text-blue-800">동시 운영 베드 수</p>
            <p className="mt-1 text-2xl font-bold text-blue-900">
              {state.operational.bedCount ?? '-'}대
            </p>
          </div>
        </div>

        {state.operational.notes && (
          <div className="mt-3 max-w-2xl">
            <p className="text-xs text-gray-500">메모</p>
            <p className="mt-1 text-sm text-gray-700">{state.operational.notes}</p>
          </div>
        )}

        {/* 경고 UI (capacityMinutes === 0일 때만 표시) */}
        {capacityMinutes === 0 && (
          <div className="mt-4">
            <Alert variant="warning" title="운영 세팅이 설정되지 않았습니다">
              <p>
                월 영업일수, 1일 영업시간, 동시 운영 가능한 베드 수를 입력해야 고정비 배분이 계산됩니다.
                현재는 고정비가 시술 원가에 반영되지 않습니다.
              </p>
            </Alert>
          </div>
        )}

        {/* 계산 결과 표시 (capacityMinutes > 0일 때) */}
        {capacityMinutes > 0 && (
          <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-4 max-w-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-800">월 가용 시간</p>
                <p className="mt-1 text-xl font-bold text-green-900">
                  {capacityMinutes.toLocaleString('ko-KR')}분
                </p>
              </div>
              <HelpTooltip content="이 값을 기준으로 고정비가 시술별로 배분됩니다." />
            </div>
            <p className="mt-2 text-xs text-green-700">
              고정비 분당 배분율 = 월 시설·운영비 / {capacityMinutes.toLocaleString('ko-KR')}분 (베드 수 포함)
            </p>
          </div>
        )}
      </section>

      {/* 수정 모달 */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title="운영 세팅 수정"
        size="sm"
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

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            동시 운영 베드 수
            <input
              name="bedCount"
              type="number"
              min={1}
              step={1}
              value={form.bedCount}
              onChange={handleChange}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="예: 4"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
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
        </form>
      </Modal>
    </>
  );
};

export default OperationalSettingsSection;
