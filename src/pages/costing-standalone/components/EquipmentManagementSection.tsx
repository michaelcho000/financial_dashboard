import React, { useState } from 'react';
import { EquipmentProfile } from '../../../services/standaloneCosting/types';
import { useStandaloneCosting } from '../state/StandaloneCostingProvider';
import { formatKrw } from '../../../utils/formatters';
import { generateId } from '../../../utils/id';

interface EquipmentFormState {
  id: string | null;
  name: string;
  leaseCost: string;
  notes: string;
}

const emptyForm: EquipmentFormState = {
  id: null,
  name: '',
  leaseCost: '',
  notes: '',
};

const EquipmentManagementSection: React.FC = () => {
  const { state, setEquipmentHierarchyEnabled, upsertEquipment, removeEquipment } = useStandaloneCosting();
  const [form, setForm] = useState<EquipmentFormState>(emptyForm);

  const handleToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEquipmentHierarchyEnabled(event.target.checked);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!state.useEquipmentHierarchy) {
      return;
    }

    const leaseCostValue = form.leaseCost.trim() ? Number(form.leaseCost) : 0;

    const payload: EquipmentProfile = {
      id: form.id ?? generateId(),
      name: form.name.trim(),
      leaseCost: Number.isFinite(leaseCostValue) ? leaseCostValue : 0,
      notes: form.notes.trim() || undefined,
    };

    upsertEquipment(payload);
    resetForm();
  };

  const handleEdit = (equipment: EquipmentProfile) => {
    setForm({
      id: equipment.id,
      name: equipment.name,
      leaseCost: String(equipment.leaseCost ?? ''),
      notes: equipment.notes ?? '',
    });
  };

  const handleDelete = (equipment: EquipmentProfile) => {
    if (!state.useEquipmentHierarchy) {
      return;
    }

    const confirmed = window.confirm(`${equipment.name} 장비를 목록에서 삭제하시겠습니까?`);
    if (confirmed) {
      removeEquipment(equipment.id);
    }
  };

  const isDisabled = !state.useEquipmentHierarchy;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <header className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">장비 상세 모드 (준비 중)</h2>
          <p className="mt-1 text-sm text-gray-600">
            장비별 리스료와 소모품을 연결해 원가를 정밀 배분하는 기능입니다. 현재는 설계 단계로, 입력된 정보는 곧바로 계산에 반영되지 않습니다.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            checked={state.useEquipmentHierarchy}
            onChange={handleToggle}
          />
          장비 상세 모드 사용 (알파)
        </label>
      </header>

      <div className="rounded-md border border-dashed border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <p className="font-medium">안내</p>
        <p className="mt-1">
          장비 상세 모드는 추후 업데이트에서 활성화됩니다. 지금은 장비 정보를 미리 등록하여 준비해 둘 수 있으며, 저장된 데이터는 향후 리스료·소모품 배분 로직과 연결될 예정입니다.
        </p>
      </div>

      <form className="mt-6 grid gap-4 md:grid-cols-3" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          장비명
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            disabled={isDisabled}
            placeholder="예: 울쎄라, 슈링크"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-400"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-gray-700">
          월 리스료 (원)
          <input
            name="leaseCost"
            type="number"
            min={0}
            value={form.leaseCost}
            onChange={handleChange}
            disabled={isDisabled}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-400"
          />
        </label>

        <label className="md:col-span-3 flex flex-col gap-1 text-sm text-gray-700">
          메모
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={2}
            disabled={isDisabled}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-400"
          />
        </label>

        <div className="md:col-span-3 flex justify-end gap-2">
          {form.id && (
            <button
              type="button"
              onClick={resetForm}
              disabled={isDisabled}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 disabled:bg-gray-100 disabled:text-gray-400"
            >
              취소
            </button>
          )}
          <button
            type="submit"
            disabled={isDisabled || !form.name.trim()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-500"
          >
            {form.id ? '변경 저장' : '장비 추가'}
          </button>
        </div>
      </form>

      <div className="mt-6 overflow-x-auto">
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
                  등록된 장비가 없습니다. 장비 상세 모드를 사용하려면 장비를 추가하세요.
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
                        onClick={() => handleEdit(item)}
                        disabled={isDisabled}
                        className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:border-gray-200 disabled:text-gray-400"
                      >
                        편집
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        disabled={isDisabled}
                        className="rounded-md border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50 disabled:border-gray-200 disabled:text-gray-400"
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

export default EquipmentManagementSection;
