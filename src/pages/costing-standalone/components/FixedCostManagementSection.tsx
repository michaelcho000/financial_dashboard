import React, { useMemo, useState } from 'react';
import { FixedCostGroup, FixedCostItem } from '../../../services/standaloneCosting/types';
import { useStandaloneCosting } from '../state/StandaloneCostingProvider';
import { formatKrw } from '../../../utils/formatters';
import { generateId } from '../../../utils/id';
import { calculateMonthlyFixedTotal, summarizeFixedCosts } from '../../../services/standaloneCosting/calculations';
import HelpTooltip from './HelpTooltip';

interface FixedCostFormState {
  id: string | null;
  name: string;
  monthlyAmount: string;
  notes: string;
  costGroup: FixedCostGroup;
}

const GROUP_ORDER: FixedCostGroup[] = ['facility', 'common', 'marketing'];

const GROUP_CONFIG: Record<FixedCostGroup, { label: string; badge: string; badgeColor: string; description: string; help: string; examples: string[] }> = {
  facility: {
    label: '시설·운영비',
    badge: '자동 배분',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    description: '영업시간에 비례해 시술 원가에 자동 배분되는 항목입니다.',
    help: '월 가용시간으로 나눠 시술별 시간에 비례해 배분됩니다.',
    examples: ['임대료', '관리비', '장비 리스료', '전기·수도'],
  },
  common: {
    label: '공통비용',
    badge: '배분 안 함',
    badgeColor: 'bg-gray-100 text-gray-800 border-gray-200',
    description: '시간과 무관하게 발생하며 손익 시나리오에서 커버해야 할 항목입니다.',
    help: '전체 매출 대비로 별도 검토합니다. 시술 원가에는 포함되지 않습니다.',
    examples: ['보험료', '카드 수수료', 'CRM 사용료', '회계·노무 비용'],
  },
  marketing: {
    label: '마케팅 비용',
    badge: 'ROI 분석용',
    badgeColor: 'bg-green-100 text-green-800 border-green-200',
    description: '시나리오/인사이트 탭에서 조정되는 마케팅 지출입니다.',
    help: '마케팅 인사이트에서 증감 시뮬레이션합니다. 시술 원가에는 포함되지 않습니다.',
    examples: ['디지털 광고', '오프라인 광고', '프로모션 이벤트'],
  },
};

const emptyFixedCostForm: FixedCostFormState = {
  id: null,
  name: '',
  monthlyAmount: '',
  notes: '',
  costGroup: 'facility',
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
  const [activeGroup, setActiveGroup] = useState<FixedCostGroup>('facility');

  const { facilityTotal, commonTotal, marketingTotal, total } = useMemo(
    () => summarizeFixedCosts(state.fixedCosts),
    [state.fixedCosts],
  );

  const groupItems = useMemo(() => {
    return state.fixedCosts.reduce<Record<FixedCostGroup, FixedCostItem[]>>(
      (acc, item) => {
        acc[item.costGroup].push(item);
        return acc;
      },
      { facility: [], common: [], marketing: [] },
    );
  }, [state.fixedCosts]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleGroupChange = (group: FixedCostGroup) => {
    setActiveGroup(group);
    setForm(prev => ({ ...prev, costGroup: group }));
  };

  const resetForm = () => {
    setForm(prev => ({ ...emptyFixedCostForm, costGroup: activeGroup }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload: FixedCostItem = {
      id: form.id ?? generateId(),
      name: form.name.trim(),
      monthlyAmount: toAmount(form.monthlyAmount),
      costGroup: form.costGroup ?? activeGroup,
      notes: form.notes.trim() || undefined,
    };

    upsertFixedCost(payload);
    resetForm();
  };

  const handleEdit = (item: FixedCostItem) => {
    setActiveGroup(item.costGroup);
    setForm({
      id: item.id,
      name: item.name,
      monthlyAmount: item.monthlyAmount ? String(item.monthlyAmount) : '',
      notes: item.notes ?? '',
      costGroup: item.costGroup,
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

  const renderGroupTable = (group: FixedCostGroup) => {
    const items = groupItems[group];
    const subtotal = calculateMonthlyFixedTotal(state.fixedCosts, group);
    const config = GROUP_CONFIG[group];
    return (
      <div key={group}>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-gray-900">{config.label}</h3>
              <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded border ${config.badgeColor}`}>
                {config.badge}
              </span>
              <HelpTooltip content={config.help} />
            </div>
            <p className="mt-1 text-sm text-gray-600">{config.description}</p>
          </div>
          <div className="text-sm text-gray-600">
            월 합계: <span className="font-semibold text-gray-900">{formatKrw(subtotal)}</span>
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          예시: {config.examples.join(', ')}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">이름</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">월 금액 (원)</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">메모</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-400" colSpan={4}>
                    등록된 항목이 없습니다.
                  </td>
                </tr>
              ) : (
                items.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900">{item.name}</td>

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
      </div>
    );
  };

  const headerDescription = GROUP_CONFIG[activeGroup];

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <header className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">인건비 제외 고정비 입력</h2>
          <p className="mt-1 text-sm text-gray-600">
            시설·운영비는 시술 시간에 따라 배분되고, 공통비용과 마케팅 비용은 시나리오 탭에서 손익을 검증합니다.
          </p>
        </div>
        <div className="text-sm text-gray-600">
          전체 합계: <span className="font-semibold text-gray-900">{formatKrw(total)}</span>
        </div>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600">
          <p className="font-semibold text-gray-700">시설·운영비</p>
          <p className="mt-1 text-base font-semibold text-gray-900">{formatKrw(facilityTotal)}</p>
        </div>
        <div className="rounded-md border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600">
          <p className="font-semibold text-gray-700">공통비용</p>
          <p className="mt-1 text-base font-semibold text-gray-900">{formatKrw(commonTotal)}</p>
        </div>
        <div className="rounded-md border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600">
          <p className="font-semibold text-gray-700">마케팅 비용</p>
          <p className="mt-1 text-base font-semibold text-gray-900">{formatKrw(marketingTotal)}</p>
        </div>
      </div>
      <div className="rounded-md border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-semibold">현재 입력 대상</p>
        <p className="mt-1">
          {headerDescription.label}: {headerDescription.description}
        </p>
        <p className="mt-1 text-xs text-blue-700">예시 항목: {headerDescription.examples.join(', ')}</p>
      </div>

      <div className="mt-4 flex gap-2">
        {GROUP_ORDER.map(group => (
          <button
            key={group}
            type="button"
            onClick={() => handleGroupChange(group)}
            className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition ${
              activeGroup === group
                ? 'border-blue-500 bg-blue-100 text-blue-700'
                : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:text-blue-600'
            }`}
          >
            {GROUP_CONFIG[group].label}
          </button>
        ))}
      </div>

      <form className="mt-4 grid gap-4 md:grid-cols-3" onSubmit={handleSubmit}>
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

      <div className="mt-6">
        {renderGroupTable(activeGroup)}
      </div>
    </section>
  );
};

export default FixedCostManagementSection;









