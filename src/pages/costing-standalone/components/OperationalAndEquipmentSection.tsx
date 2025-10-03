import React, { useEffect, useMemo, useState } from 'react';
import { calculateOperationalMinutes } from '../../../services/standaloneCosting/calculations';
import { EquipmentProfile } from '../../../services/standaloneCosting/types';
import { useStandaloneCosting } from '../state/StandaloneCostingProvider';
import { formatKrw, formatNumberInput, parseNumberInput } from '../../../utils/formatters';
import { generateId } from '../../../utils/id';
import Alert from './Alert';
import HelpTooltip from './HelpTooltip';
import Modal from '../../../components/common/Modal';

interface OperationalFormState {
  operatingDays: string;
  operatingHoursPerDay: string;
  notes: string;
}

interface EquipmentFormState {
  id: string | null;
  name: string;
  leaseCost: string;
  notes: string;
}

const emptyEquipmentForm: EquipmentFormState = {
  id: null,
  name: '',
  leaseCost: '',
  notes: '',
};

const OperationalAndEquipmentSection: React.FC = () => {
  const { state, setOperationalConfig, setEquipmentHierarchyEnabled, upsertEquipment, removeEquipment } = useStandaloneCosting();

  // Operational state
  const [operationalForm, setOperationalForm] = useState<OperationalFormState>({
    operatingDays: '',
    operatingHoursPerDay: '',
    notes: ''
  });
  const [isOperationalModalOpen, setIsOperationalModalOpen] = useState(false);

  // Equipment state
  const [equipmentForm, setEquipmentForm] = useState<EquipmentFormState>(emptyEquipmentForm);
  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);

  // Load operational config
  useEffect(() => {
    const { operatingDays, operatingHoursPerDay, notes } = state.operational;
    setOperationalForm({
      operatingDays: operatingDays !== null && operatingDays !== undefined ? String(operatingDays) : '',
      operatingHoursPerDay: operatingHoursPerDay !== null && operatingHoursPerDay !== undefined ? String(operatingHoursPerDay) : '',
      notes: notes ?? '',
    });
  }, [state.operational]);

  const capacityMinutes = useMemo(() => calculateOperationalMinutes(state.operational), [state.operational]);

  // Operational handlers
  const handleOperationalChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setOperationalForm(prev => ({ ...prev, [name]: value }));
  };

  const handleOperationalSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const operatingDaysValue = operationalForm.operatingDays.trim() ? Number(operationalForm.operatingDays) : null;
    const operatingHoursValue = operationalForm.operatingHoursPerDay.trim() ? Number(operationalForm.operatingHoursPerDay) : null;

    setOperationalConfig({
      operatingDays: typeof operatingDaysValue === 'number' && Number.isFinite(operatingDaysValue) ? operatingDaysValue : null,
      operatingHoursPerDay: typeof operatingHoursValue === 'number' && Number.isFinite(operatingHoursValue) ? operatingHoursValue : null,
      notes: operationalForm.notes.trim() || undefined,
    });
    setIsOperationalModalOpen(false);
  };

  const openOperationalModal = () => {
    setIsOperationalModalOpen(true);
  };

  const closeOperationalModal = () => {
    setIsOperationalModalOpen(false);
  };

  // Equipment handlers
  const handleEquipmentToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEquipmentHierarchyEnabled(event.target.checked);
  };

  const handleEquipmentChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    if (name === 'leaseCost') {
      setEquipmentForm(prev => ({ ...prev, [name]: parseNumberInput(value) }));
    } else {
      setEquipmentForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const resetEquipmentForm = () => {
    setEquipmentForm(emptyEquipmentForm);
  };

  const handleEquipmentSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const leaseCostValue = equipmentForm.leaseCost.trim() ? Number(equipmentForm.leaseCost) : 0;

    const payload: EquipmentProfile = {
      id: equipmentForm.id ?? generateId(),
      name: equipmentForm.name.trim(),
      leaseCost: Number.isFinite(leaseCostValue) ? leaseCostValue : 0,
      notes: equipmentForm.notes.trim() || undefined,
    };

    upsertEquipment(payload);
    resetEquipmentForm();
    setIsEquipmentModalOpen(false);
  };

  const openEquipmentModal = () => {
    resetEquipmentForm();
    setIsEquipmentModalOpen(true);
  };

  const closeEquipmentModal = () => {
    setIsEquipmentModalOpen(false);
    resetEquipmentForm();
  };

  const handleEquipmentEdit = (equipment: EquipmentProfile) => {
    setEquipmentForm({
      id: equipment.id,
      name: equipment.name,
      leaseCost: String(equipment.leaseCost ?? ''),
      notes: equipment.notes ?? '',
    });
    setIsEquipmentModalOpen(true);
  };

  const handleEquipmentDelete = (equipment: EquipmentProfile) => {
    const confirmed = window.confirm(`${equipment.name} 장비를 목록에서 삭제하시겠습니까?`);
    if (confirmed) {
      removeEquipment(equipment.id);
      if (equipmentForm.id === equipment.id) {
        resetEquipmentForm();
      }
    }
  };

  return (
    <>
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">운영 및 장비 설정</h2>
            <p className="mt-1 text-sm text-gray-600">월 가용 시간을 정의하고, 장비 상세 모드를 설정합니다.</p>
          </div>
          <button
            onClick={openOperationalModal}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            ⚙️ 수정
          </button>
        </header>

        {/* 3칼럼 그리드: 영업일수, 영업시간, 장비 모드 */}
        <div className="grid gap-3 sm:grid-cols-3">
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
          <div className="rounded-md border border-gray-100 bg-gray-50 p-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium text-gray-800">장비 상세 모드</p>
                <p className="text-xs text-gray-600 mt-0.5">(준비 중)</p>
              </div>
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={state.useEquipmentHierarchy}
                onChange={handleEquipmentToggle}
              />
            </label>
          </div>
        </div>

        {state.operational.notes && (
          <div className="mt-3">
            <p className="text-xs text-gray-500">메모</p>
            <p className="mt-1 text-sm text-gray-700">{state.operational.notes}</p>
          </div>
        )}

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
          <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-4">
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
              고정비 분당 배분율 = 월 시설·운영비 / {capacityMinutes.toLocaleString('ko-KR')}분
            </p>
          </div>
        )}

        {/* 장비 모드 ON일 때만 표시 */}
        {state.useEquipmentHierarchy && (
          <>
            <div className="mt-6 rounded-md border border-dashed border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              <p className="font-medium">장비 상세 모드 안내</p>
              <p className="mt-1">
                장비별 리스료와 소모품을 연결해 원가를 정밀 배분하는 기능입니다. 현재는 설계 단계로, 입력된 정보는 곧바로 계산에 반영되지 않습니다.
                추후 업데이트에서 활성화될 예정입니다.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">등록된 장비</h3>
              <button
                onClick={openEquipmentModal}
                className="rounded-md border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                + 장비 추가
              </button>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">장비명</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">월 리스료</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">메모</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {state.equipment.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-gray-400" colSpan={4}>
                        등록된 장비가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    state.equipment.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-900">{item.name}</td>
                        <td className="px-4 py-2 text-right text-gray-900">{formatKrw(item.leaseCost)}</td>
                        <td className="px-4 py-2 text-gray-600">{item.notes || '-'}</td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleEquipmentEdit(item)}
                              className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-100"
                            >
                              편집
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEquipmentDelete(item)}
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
          </>
        )}
      </section>

      {/* 운영 세팅 수정 모달 */}
      <Modal
        isOpen={isOperationalModalOpen}
        onClose={closeOperationalModal}
        title="운영 세팅 수정"
        size="sm"
        footer={
          <>
            <button
              onClick={closeOperationalModal}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              취소
            </button>
            <button
              onClick={handleOperationalSubmit}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              저장
            </button>
          </>
        }
      >
        <form onSubmit={handleOperationalSubmit} className="space-y-4">
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            월 영업일수
            <input
              name="operatingDays"
              type="number"
              min={0}
              value={operationalForm.operatingDays}
              onChange={handleOperationalChange}
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
              value={operationalForm.operatingHoursPerDay}
              onChange={handleOperationalChange}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="예: 10"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            메모
            <textarea
              name="notes"
              value={operationalForm.notes}
              onChange={handleOperationalChange}
              rows={3}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="운영 시간 비고를 입력하세요."
            />
          </label>
        </form>
      </Modal>

      {/* 장비 추가/편집 모달 */}
      <Modal
        isOpen={isEquipmentModalOpen}
        onClose={closeEquipmentModal}
        title={equipmentForm.id ? '장비 정보 수정' : '장비 추가'}
        size="md"
        footer={
          <>
            <button
              onClick={closeEquipmentModal}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              취소
            </button>
            <button
              onClick={handleEquipmentSubmit}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              저장
            </button>
          </>
        }
      >
        <form onSubmit={handleEquipmentSubmit} className="space-y-4">
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            장비명
            <input
              name="name"
              value={equipmentForm.name}
              onChange={handleEquipmentChange}
              required
              placeholder="예: 울쎄라, 슈링크"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            월 리스료 (원)
            <input
              name="leaseCost"
              type="text"
              value={formatNumberInput(equipmentForm.leaseCost)}
              onChange={handleEquipmentChange}
              placeholder="예: 1,500,000"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            메모
            <textarea
              name="notes"
              value={equipmentForm.notes}
              onChange={handleEquipmentChange}
              rows={3}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </form>
      </Modal>
    </>
  );
};

export default OperationalAndEquipmentSection;
