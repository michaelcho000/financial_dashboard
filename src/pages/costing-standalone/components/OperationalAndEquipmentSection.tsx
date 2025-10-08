import React, { useMemo, useState } from 'react';
import { calculateMonthlyFixedTotal, calculateOperationalMinutes } from '../../../services/standaloneCosting/calculations';
import { EquipmentProfile } from '../../../services/standaloneCosting/types';
import { useStandaloneCosting } from '../state/StandaloneCostingProvider';
import { formatKrw, formatNumberInput, parseNumberInput } from '../../../utils/formatters';
import { generateId } from '../../../utils/id';
import Alert from './Alert';
import Modal from '../../../components/common/Modal';
import OperationalSettingsSection from './OperationalSettingsSection';

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
  const { state, setEquipmentHierarchyEnabled, upsertEquipment, removeEquipment } = useStandaloneCosting();

  const [equipmentForm, setEquipmentForm] = useState<EquipmentFormState>(emptyEquipmentForm);
  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);

  const capacityMinutes = useMemo(() => calculateOperationalMinutes(state.operational), [state.operational]);

  const facilityFixedCost = useMemo(
    () => calculateMonthlyFixedTotal(state.fixedCosts, 'facility'),
    [state.fixedCosts],
  );

  const perMinuteCost = useMemo(() => {
    if (capacityMinutes === 0) {
      return 0;
    }
    return facilityFixedCost / capacityMinutes;
  }, [facilityFixedCost, capacityMinutes]);

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
      <OperationalSettingsSection />

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">장비 상세 모드</h2>
            <p className="mt-1 text-sm text-gray-600">장비별 리스료를 관리합니다 (준비 중).</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={state.useEquipmentHierarchy}
                onChange={handleEquipmentToggle}
              />
              <span className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all" />
              <span className="ms-3 text-sm font-medium text-gray-700">활성화</span>
            </label>
            {state.useEquipmentHierarchy && (
              <button
                onClick={openEquipmentModal}
                className="rounded-md border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                + 장비 추가
              </button>
            )}
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-center shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">시설·운영비 총액</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{formatKrw(facilityFixedCost)}</p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center shadow-sm">
            <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">월 가용 시간</p>
            <p className="mt-2 text-3xl font-bold text-blue-900">
              {capacityMinutes > 0 ? capacityMinutes.toLocaleString('ko-KR') : '-'}
            </p>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center shadow-sm">
            <p className="text-xs font-medium text-green-700 uppercase tracking-wide">시설비 분당 배분율</p>
            <p className="mt-2 text-3xl font-bold text-green-900">
              {capacityMinutes > 0 ? formatKrw(Math.round(perMinuteCost)) : '-'}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-center shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">등록된 장비</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {state.useEquipmentHierarchy ? state.equipment.length : 0}개
            </p>
          </div>
        </div>

        {!state.useEquipmentHierarchy && (
          <Alert variant="info" title="장비 상세 모드가 비활성화되어 있습니다.">
            <p>장비별 리스료를 관리하려면 상세 모드를 활성화하세요.</p>
          </Alert>
        )}

        {state.useEquipmentHierarchy ? (
          <>
            <div className="mb-4 rounded-md border border-dashed border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              <p className="font-medium">안내</p>
              <p className="mt-1">
                장비별 리스료와 소모품을 연결해 원가를 정밀 배분하는 기능입니다. 현재는 설계 단계로, 입력된 정보는 곧바로 계산에
                반영되지 않습니다. 추후 업데이트에서 활성화될 예정입니다.
              </p>
            </div>

            <div className="overflow-x-auto rounded-md border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">장비명</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">월 리스료</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">비고</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {state.equipment.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">
                        등록된 장비가 없습니다. 상단의 &ldquo;+ 장비 추가&rdquo; 버튼을 눌러 등록해 보세요.
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
        ) : (
          <div className="rounded-md bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
            장비 상세 모드를 활성화하면 장비별 리스료를 관리할 수 있습니다.
          </div>
        )}
      </section>

      <Modal
        isOpen={isEquipmentModalOpen}
        onClose={closeEquipmentModal}
        title={equipmentForm.id ? '장비 수정' : '장비 추가'}
        size="sm"
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
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="예: 레이저 장비"
              required
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            월 리스료 (원)
            <input
              name="leaseCost"
              value={formatNumberInput(equipmentForm.leaseCost)}
              onChange={handleEquipmentChange}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="예: 500000"
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
              placeholder="장비와 관련된 메모를 입력하세요."
            />
          </label>
        </form>
      </Modal>
    </>
  );
};

export default OperationalAndEquipmentSection;
