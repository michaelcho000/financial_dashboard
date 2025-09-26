import React, { useMemo, useState } from 'react';
import { FixedCostItem } from '../../../services/standaloneCosting/types';
import { useStandaloneCosting } from '../state/StandaloneCostingProvider';
import { formatKrw } from '../../../utils/formatters';
import { generateId } from '../../../utils/id';
import { calculateMonthlyFixedTotal } from '../../../services/standaloneCosting/calculations';

interface FixedCostFormState {
  id: string | null;
  name: string;
  monthlyAmount: string;
  category: string;
  notes: string;
}

const emptyFixedCostForm: FixedCostFormState = {
  id: null,
  name: '',
  monthlyAmount: '',
  category: '',
  notes: '',
};

const toAmount = (value: string): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }
  return numeric;
};

const FixedCostManagementSection: React.FC = () => {
  const { state, upsertFixedCost, removeFixedCost } = useStandaloneCosting();
  const [form, setForm] = useState<FixedCostFormState>(emptyFixedCostForm);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setForm(emptyFixedCostForm);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload: FixedCostItem = {
      id: form.id ?? generateId(),
      name: form.name.trim(),
      monthlyAmount: toAmount(form.monthlyAmount),
      category: form.category.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };

    upsertFixedCost(payload);
    resetForm();
  };

  const handleEdit = (item: FixedCostItem) => {
    setForm({
      id: item.id,
      name: item.name,
      monthlyAmount: String(item.monthlyAmount ?? ''),
      category: item.category ?? '',
      notes: item.notes ?? '',
    });
  };

  const handleDelete = (item: FixedCostItem) => {
    const confirmed = window.confirm(`${item.name} 고정비를 삭제하시겠습니까?`);
    if (confirmed) {
      removeFixedCost(item.id);
      if (form.id === item.id) {
        resetForm();
      }
    }
  };

  const totalFixedCost = useMemo(() => calculateMonthlyFixedTotal(state.fixedCosts), [state.fixedCosts]);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">4. 고정비 관리</h2>
          <p className="mt-1 text-sm text-gray-600">임차료, 관리비 등 월 고정비 항목을 입력합니다.</p>
        </div>
        <div className="text-sm text-gray-600">
          총 고정비: <span className="font-semibold text-gray-900">{formatKrw(totalFixedCost)}</span>
        </div>
      </header>

      <form className="grid gap-4 md:grid-cols-3" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          고정비 이름
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-gray-700">
          월 금액 (원)
          <input
            name="monthlyAmount"
            type="number"
            min={0}
            value={form.monthlyAmount}
            onChange={handleChange}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-gray-700">
          카테고리
          <input
            name="category"
            value={form.category}
            onChange={handleChange}
            placeholder="예: 시설비, 인건비, 행정"
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
            {form.id ? '변경 저장' : '고정비 추가'}
          </button>
        </div>
      </form>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">이름</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">카테고리</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500">월 금액</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">메모</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {state.fixedCosts.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-gray-400" colSpan={5}>
                  등록된 고정비가 없습니다.
                </td>
              </tr>
            ) : (
              state.fixedCosts.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{item.name}</td>
                  <td className="px-4 py-2 text-gray-600">{item.category || '-'}</td>
                  <td className="px-4 py-2 text-right text-gray-900">{formatKrw(item.monthlyAmount)}</td>
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

export default FixedCostManagementSection;
