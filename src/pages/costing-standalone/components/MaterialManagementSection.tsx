import React, { useMemo, useState } from 'react';
import { calculateMaterialUnitCost } from '../../../services/standaloneCosting/calculations';
import { MaterialItem } from '../../../services/standaloneCosting/types';
import { useStandaloneCosting } from '../state/StandaloneCostingProvider';
import { formatKrw, formatNumberInput, parseNumberInput } from '../../../utils/formatters';
import { generateId } from '../../../utils/id';
import Modal from '../../../components/common/Modal';

interface MaterialFormState {
  id: string | null;
  name: string;
  unitLabel: string;
  unitQuantity: string;
  unitPrice: string;
  notes: string;
}

const emptyMaterialForm: MaterialFormState = {
  id: null,
  name: '',
  unitLabel: '',
  unitQuantity: '',
  unitPrice: '',
  notes: '',
};

const toPositiveNumber = (value: string): number | null => {
  if (!value.trim()) {
    return null;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return numeric;
};

const MaterialManagementSection: React.FC = () => {
  const { state, upsertMaterial, removeMaterial } = useStandaloneCosting();
  const [form, setForm] = useState<MaterialFormState>(emptyMaterialForm);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    // 금액 필드는 콤마를 제거한 순수 숫자만 저장
    if (name === 'unitPrice') {
      setForm(prev => ({ ...prev, [name]: parseNumberInput(value) }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const resetForm = () => {
    setForm(emptyMaterialForm);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const unitQuantity = toPositiveNumber(form.unitQuantity) ?? 1;
    const unitPrice = toPositiveNumber(form.unitPrice) ?? 0;

    const payload: MaterialItem = {
      id: form.id ?? generateId(),
      name: form.name.trim(),
      unitLabel: form.unitLabel.trim() || '단위',
      unitQuantity,
      unitPrice,
      notes: form.notes.trim() || undefined,
    };

    upsertMaterial(payload);
    resetForm();
    setIsModalOpen(false);
  };

  const openModal = () => {
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleEdit = (material: MaterialItem) => {
    setForm({
      id: material.id,
      name: material.name,
      unitLabel: material.unitLabel,
      unitQuantity: String(material.unitQuantity ?? ''),
      unitPrice: String(material.unitPrice ?? ''),
      notes: material.notes ?? '',
    });
    setIsModalOpen(true);
  };

  const handleDelete = (material: MaterialItem) => {
    const confirmed = window.confirm(
      `${material.name} 소모품을 삭제하시겠습니까? 연결된 시술에서 제거됩니다.`,
    );
    if (confirmed) {
      removeMaterial(material.id);
      if (form.id === material.id) {
        resetForm();
      }
    }
  };

  const materialsWithDerived = useMemo(
    () =>
      state.materials.map(item => ({
        ...item,
        unitCost: calculateMaterialUnitCost(item),
      })),
    [state.materials],
  );

  return (
    <>
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">소모품 관리</h2>
            <p className="mt-1 text-sm text-gray-600">울쎄라 팁, 필러 등 단위/단가 정보를 저장합니다.</p>
          </div>
          <button
            onClick={openModal}
            className="rounded-md border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            + 소모품 추가
          </button>
        </header>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">이름</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">구매 단위</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">구매 가격 (원)</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">단위당 원가 (원)</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">메모</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {materialsWithDerived.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-400" colSpan={6}>
                    등록된 소모품이 없습니다.
                  </td>
                </tr>
              ) : (
                materialsWithDerived.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900">{item.name}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {item.unitQuantity.toLocaleString('ko-KR')} {item.unitLabel}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-900">{formatKrw(item.unitPrice)}</td>
                    <td className="px-4 py-2 text-right text-gray-900">{formatKrw(item.unitCost)}</td>
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

      {/* 소모품 추가/편집 모달 */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={form.id ? '소모품 정보 수정' : '소모품 추가'}
        size="md"
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
            소모품 이름
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              단위 명칭
              <input
                name="unitLabel"
                value={form.unitLabel}
                onChange={handleChange}
                placeholder="예: 샷, cc, vial"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-gray-700">
              구매 단위 수량
              <input
                name="unitQuantity"
                type="number"
                min={1}
                value={form.unitQuantity}
                onChange={handleChange}
                placeholder="예: 2400"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <span className="text-xs text-gray-500">1회 구매 시 포함된 수량</span>
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            구매 가격 (원)
            <input
              name="unitPrice"
              type="text"
              value={formatNumberInput(form.unitPrice)}
              onChange={handleChange}
              placeholder="예: 3,500,000"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <span className="text-xs text-gray-500">구매 단위 수량에 대한 가격</span>
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            메모
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={3}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </form>
      </Modal>
    </>
  );
};

export default MaterialManagementSection;
