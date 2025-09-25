import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from '../../components/ui/Table';
import { useCostingBaselines } from '../../contexts/CostingBaselineContext';
import { useCostingServices } from '../../contexts/CostingServicesContext';
import {
  ConsumablePricingInput,
  StaffCapacityInput,
  BaselineCreatePayload,
  BaselineStatus,
  FixedCostItemState,
} from '../../services/costing/types';
import { formatCurrency } from '../../utils/formatters';

import CostingPlaceholder from './CostingPlaceholder';

interface EditableStaff extends StaffCapacityInput {
  clientId: string;
}

interface EditableConsumable extends ConsumablePricingInput {
  clientId: string;
}

const createClientId = () => `tmp-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;

const normaliseNumber = (value: string, fallback = 0): number => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return fallback;
  const numeric = Number(trimmed.replace(/,/g, ''));
  return Number.isFinite(numeric) ? numeric : fallback;
};

const CostingBasePage: React.FC = () => {
  const {
    baselines,
    selectedBaselineId,
    selectedBaseline,
    selectBaseline,
    createBaseline,
    updateBaseline,
    refreshBaselines,
    loading,
    error,
  } = useCostingBaselines();
  const { staffDataService, consumableDataService, fixedCostLinkService, calculationService } =
    useCostingServices();

  const [staffEntries, setStaffEntries] = useState<EditableStaff[]>([]);
  const [consumableEntries, setConsumableEntries] = useState<EditableConsumable[]>([]);
  const [fixedCostItems, setFixedCostItems] = useState<FixedCostItemState[]>([]);
  const [fixedCostInclude, setFixedCostInclude] = useState(true);
  const [staffSaving, setStaffSaving] = useState(false);
  const [consumableSaving, setConsumableSaving] = useState(false);
  const [fixedCostSaving, setFixedCostSaving] = useState(false);
  const [staffDirty, setStaffDirty] = useState(false);
  const [consumableDirty, setConsumableDirty] = useState(false);
  const [fixedCostDirty, setFixedCostDirty] = useState(false);
  const [recalcState, setRecalcState] = useState<'idle' | 'running' | 'done'>('idle');
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'staff' | 'consumables'>('staff');

  const [newMonth, setNewMonth] = useState('');
  const [newIncludeFixed, setNewIncludeFixed] = useState(true);
  const [newSourceBaselineId, setNewSourceBaselineId] = useState<string | null>(null);

  const loadBaselineData = useCallback(async () => {
    if (!selectedBaselineId) {
      setStaffEntries([]);
      setConsumableEntries([]);
      setFixedCostItems([]);
      setFixedCostInclude(true);
      return;
    }
    try {
      const [staff, consumables, fixedCosts] = await Promise.all([
        staffDataService.getStaff(selectedBaselineId),
        consumableDataService.getConsumables(selectedBaselineId),
        fixedCostLinkService.getSelection(selectedBaselineId),
      ]);
      setStaffEntries(
        staff.map(entry => ({
          clientId: createClientId(),
          ...entry,
        }))
      );
      setConsumableEntries(
        consumables.map(entry => ({
          clientId: createClientId(),
          ...entry,
        }))
      );
      setFixedCostItems(fixedCosts.items.map(item => ({ ...item })));
      setFixedCostInclude(fixedCosts.includeFixedCosts);
      setStaffDirty(false);
      setConsumableDirty(false);
      setFixedCostDirty(false);
    } catch (err) {
      console.error('[Costing] Failed to load staff/consumable data', err);
      setFormMessage('기준월 데이터를 불러오지 못했습니다. 페이지를 새로고침 해주세요.');
    }
  }, [
    selectedBaselineId,
    staffDataService,
    consumableDataService,
    fixedCostLinkService,
  ]);

  useEffect(() => {
    loadBaselineData();
  }, [loadBaselineData]);

  const handleCreateBaseline = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newMonth) {
      setFormMessage('생성할 월을 입력해주세요. 예: 2025-03');
      return;
    }
    const payload: BaselineCreatePayload = {
      month: newMonth,
      includeFixedCosts: newIncludeFixed,
      sourceBaselineId: newSourceBaselineId,
    };
    try {
      await createBaseline(payload);
      setFormMessage('기준월을 생성했습니다.');
      setNewMonth('');
      setNewSourceBaselineId(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : '기준월 생성에 실패했습니다.';
      setFormMessage(message);
    }
  };

  const handleStaffChange = (clientId: string, field: keyof EditableStaff, value: string) => {
    setStaffEntries(prev =>
      prev.map(entry =>
        entry.clientId === clientId
          ? {
              ...entry,
              [field]: field === 'monthlyPayroll' || field === 'availableMinutes' ? normaliseNumber(value) : value,
            }
          : entry
      )
    );
    setStaffDirty(true);
  };

  const handleConsumableChange = (clientId: string, field: keyof EditableConsumable, value: string) => {
    setConsumableEntries(prev =>
      prev.map(entry =>
        entry.clientId === clientId
          ? {
              ...entry,
              [field]:
                field === 'purchaseCost' || field === 'yieldQuantity'
                  ? normaliseNumber(value, field === 'yieldQuantity' ? 1 : 0)
                  : value,
            }
          : entry
      )
    );
    setConsumableDirty(true);
  };

  const addStaffRow = () => {
    setStaffEntries(prev => [
      ...prev,
      {
        clientId: createClientId(),
        roleName: '',
        monthlyPayroll: 0,
        availableMinutes: 0,
      },
    ]);
    setStaffDirty(true);
  };

  const removeStaffRow = (clientId: string) => {
    setStaffEntries(prev => prev.filter(entry => entry.clientId !== clientId));
    setStaffDirty(true);
  };

  const addConsumableRow = () => {
    setConsumableEntries(prev => [
      ...prev,
      {
        clientId: createClientId(),
        consumableName: '',
        purchaseCost: 0,
        yieldQuantity: 1,
        unit: '',
      },
    ]);
    setConsumableDirty(true);
  };

  const removeConsumableRow = (clientId: string) => {
    setConsumableEntries(prev => prev.filter(entry => entry.clientId !== clientId));
    setConsumableDirty(true);
  };

  const handleSaveStaff = async () => {
    if (!selectedBaselineId) {
      setFormMessage('선택된 기준월이 없습니다.');
      return;
    }
    setStaffSaving(true);
    setFormMessage(null);
    try {
      const payload: StaffCapacityInput[] = staffEntries
        .filter(entry => entry.roleName.trim().length > 0)
        .map(({ clientId, ...rest }) => ({ ...rest }));
      await staffDataService.upsertStaff(selectedBaselineId, payload);
      setFormMessage('인력 설정을 저장했습니다.');
      setStaffDirty(false);
    } catch (err) {
      console.error('[Costing] Failed to save staff', err);
      setFormMessage(err instanceof Error ? err.message : '인력 설정 저장에 실패했습니다.');
    } finally {
      setStaffSaving(false);
    }
  };

  const handleSaveConsumables = async () => {
    if (!selectedBaselineId) {
      setFormMessage('선택된 기준월이 없습니다.');
      return;
    }
    setConsumableSaving(true);
    setFormMessage(null);
    try {
      const payload: ConsumablePricingInput[] = consumableEntries
        .filter(entry => entry.consumableName.trim().length > 0)
        .map(({ clientId, ...rest }) => ({ ...rest }));
      await consumableDataService.upsertConsumables(selectedBaselineId, payload);
      setFormMessage('소모품 단가를 저장했습니다.');
      setConsumableDirty(false);
    } catch (err) {
      console.error('[Costing] Failed to save consumables', err);
      setFormMessage(err instanceof Error ? err.message : '소모품 단가 저장에 실패했습니다.');
    } finally {
      setConsumableSaving(false);
    }
  };

  const handleToggleFixedCostInclude = (include: boolean) => {
    setFixedCostInclude(include);
    setFixedCostDirty(true);
  };

  const handleToggleFixedCostItem = (templateId: string) => {
    setFixedCostItems(prev =>
      prev.map(item =>
        item.templateId === templateId ? { ...item, included: !item.included } : item
      )
    );
    setFixedCostDirty(true);
  };

  const totalSelectedFixedCost = useMemo(() => {
    if (!fixedCostInclude) {
      return 0;
    }
    return fixedCostItems
      .filter(item => item.included)
      .reduce((sum, item) => sum + (item.monthlyCost ?? 0), 0);
  }, [fixedCostInclude, fixedCostItems]);

  const includedCount = useMemo(() => {
    if (!fixedCostInclude) {
      return 0;
    }
    return fixedCostItems.filter(item => item.included).length;
  }, [fixedCostInclude, fixedCostItems]);

  const handleSaveFixedCosts = async () => {
    if (!selectedBaselineId) {
      setFormMessage('선택된 기준월이 없습니다.');
      return;
    }
    setFixedCostSaving(true);
    setFormMessage(null);
    try {
      await fixedCostLinkService.updateSelection(selectedBaselineId, {
        includeFixedCosts: fixedCostInclude,
        items: fixedCostItems.map(item => ({ ...item })),
      });
      await refreshBaselines();
      setFormMessage('고정비 설정을 저장했습니다.');
      setFixedCostDirty(false);
    } catch (err) {
      console.error('[Costing] Failed to save fixed cost selection', err);
      setFormMessage(err instanceof Error ? err.message : '고정비 설정 저장에 실패했습니다.');
    } finally {
      setFixedCostSaving(false);
    }
  };

  const handleRecalculate = async () => {
    if (!selectedBaselineId) {
      setFormMessage('선택된 기준월이 없습니다.');
      return;
    }
    setRecalcState('running');
    setFormMessage(null);
    try {
      await calculationService.recalculate(selectedBaselineId);
      setRecalcState('done');
      setFormMessage('원가 계산을 완료했습니다. 결과 화면에서 확인할 수 있습니다.');
      await loadBaselineData();
    } catch (err) {
      console.error('[Costing] Failed to recalculate', err);
      setFormMessage(err instanceof Error ? err.message : '원가 계산에 실패했습니다.');
      setRecalcState('idle');
    }
  };

  useEffect(() => {
    setRecalcState('idle');
    setFormMessage(null);
    setActiveTab('staff');
  }, [selectedBaselineId]);

  const selectedStatusLabel: string = useMemo(() => {
    if (!selectedBaseline) return '';
    const labels: Record<BaselineStatus, string> = {
      DRAFT: '초안',
      READY: '준비됨',
      LOCKED: '잠금',
    };
    return labels[selectedBaseline.status];
  }, [selectedBaseline]);

  const renderBaselineControls = () => (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">기준월 관리</h2>
          <p className="text-sm text-gray-500">월별 데이터를 선택하거나 새 기준월을 생성하세요.</p>
        </div>
        <form className="flex flex-col gap-2 md:flex-row md:items-end" onSubmit={handleCreateBaseline}>
          <div>
            <label className="text-xs font-medium text-gray-600">월 (YYYY-MM)</label>
            <input
              value={newMonth}
              onChange={event => setNewMonth(event.target.value)}
              placeholder="2025-03"
              className="mt-1 w-32 rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">고정비 반영</label>
            <select
              value={newIncludeFixed ? 'true' : 'false'}
              onChange={event => setNewIncludeFixed(event.target.value === 'true')}
              className="mt-1 w-28 rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="true">포함</option>
              <option value="false">제외</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">복사 원본</label>
            <select
              value={newSourceBaselineId ?? ''}
              onChange={event => setNewSourceBaselineId(event.target.value || null)}
              className="mt-1 w-40 rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">(선택 안 함)</option>
              {baselines.map(baseline => (
                <option key={baseline.id} value={baseline.id}>
                  {baseline.month}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            disabled={loading}
          >
            기준월 생성
          </button>
        </form>
      </header>

      <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-gray-700">선택된 기준월</label>
          <select
            value={selectedBaselineId ?? ''}
            onChange={event => handleBaselineSelect(event.target.value || null)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">기준월 선택</option>
            {baselines.map(baseline => (
              <option key={baseline.id} value={baseline.id}>
                {baseline.month} · {baseline.status}
              </option>
            ))}
          </select>
          {selectedBaseline && (
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
              상태: {selectedStatusLabel}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {selectedBaseline && (
            <>
              <button
                type="button"
                onClick={() => updateBaseline(selectedBaseline.id, { includeFixedCosts: !selectedBaseline.includeFixedCosts })}
                className="rounded-md border border-gray-300 px-3 py-2 text-xs text-gray-600 hover:bg-gray-100"
              >
                고정비 {selectedBaseline.includeFixedCosts ? '포함' : '미포함'} 전환
              </button>
              <button
                type="button"
                onClick={handleRecalculate}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                disabled={recalcState === 'running'}
              >
                {recalcState === 'running' ? '계산 중...' : '재계산 실행'}
              </button>
            </>
          )}
        </div>
      </div>

      {selectedBaseline && (
        <dl className="mt-4 grid gap-4 text-sm text-gray-600 sm:grid-cols-3">
          <div>
            <dt className="font-medium text-gray-700">선택한 월</dt>
            <dd>{selectedBaseline.month}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-700">마지막 계산</dt>
            <dd>{selectedBaseline.lastCalculatedAt ? new Date(selectedBaseline.lastCalculatedAt).toLocaleString() : '미실행'}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-700">고정비 반영</dt>
            <dd>{selectedBaseline.includeFixedCosts ? '포함' : '제외'}</dd>
          </div>
        </dl>
      )}
    </section>
  );

  const baselineLocked = selectedBaseline?.status === 'LOCKED';
  const hasUnsavedChanges = fixedCostDirty || staffDirty || consumableDirty;

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  const confirmNavigationIfDirty = useCallback(() => {
    if (!hasUnsavedChanges) {
      return true;
    }
    return window.confirm('저장하지 않은 변경사항이 있습니다. 이동하시겠습니까?');
  }, [hasUnsavedChanges]);

  const handleBaselineSelect = (nextBaselineId: string | null) => {
    if (nextBaselineId === selectedBaselineId) {
      return;
    }
    if (!confirmNavigationIfDirty()) {
      return;
    }
    selectBaseline(nextBaselineId);
  };

  const renderStaffContent = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">인력 설정</h3>
          <p className="text-sm text-gray-500">역할별 월 급여와 가용 시간을 입력하세요.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (baselineLocked) {
              return;
            }
            addStaffRow();
          }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
          disabled={baselineLocked}
        >
          행 추가
        </button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>역할 이름</TableHead>
              <TableHead className="w-36 text-right">월 급여 (원)</TableHead>
              <TableHead className="w-40 text-right">가용 시간 (분)</TableHead>
              <TableHead className="w-24 text-center">삭제</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staffEntries.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-gray-500">
                  등록된 인력 정보가 없습니다. 행 추가를 눌러 입력하세요.
                </TableCell>
              </TableRow>
            )}
            {staffEntries.map(entry => (
              <TableRow key={entry.clientId}>
                <TableCell>
                  <input
                    value={entry.roleName}
                    onChange={event => handleStaffChange(entry.clientId, 'roleName', event.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    placeholder="예: 간호사"
                    disabled={baselineLocked}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <input
                    value={entry.monthlyPayroll === 0 ? '' : entry.monthlyPayroll}
                    onChange={event => handleStaffChange(entry.clientId, 'monthlyPayroll', event.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-right"
                    placeholder="0"
                    disabled={baselineLocked}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <input
                    value={entry.availableMinutes === 0 ? '' : entry.availableMinutes}
                    onChange={event => handleStaffChange(entry.clientId, 'availableMinutes', event.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-right"
                    placeholder="0"
                    disabled={baselineLocked}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (baselineLocked) {
                        return;
                      }
                      removeStaffRow(entry.clientId);
                    }}
                    className="text-sm text-red-500 hover:underline"
                    disabled={baselineLocked}
                  >
                    삭제
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSaveStaff}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          disabled={baselineLocked || staffSaving || !selectedBaselineId || !staffDirty}
        >
          {staffSaving ? '저장 중...' : '인력 설정 저장'}
        </button>
      </div>
    </div>
  );

  const renderConsumableContent = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">소모품 단가</h3>
          <p className="text-sm text-gray-500">구매 단가와 사용 단위를 입력하세요.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (baselineLocked) {
              return;
            }
            addConsumableRow();
          }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
          disabled={baselineLocked}
        >
          행 추가
        </button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>소모품 이름</TableHead>
              <TableHead className="w-36 text-right">구매 단가 (원)</TableHead>
              <TableHead className="w-36 text-right">수량/단위</TableHead>
              <TableHead className="w-24">단위</TableHead>
              <TableHead className="w-24 text-center">삭제</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {consumableEntries.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-gray-500">
                  등록된 소모품 정보가 없습니다. 행 추가를 눌러 입력하세요.
                </TableCell>
              </TableRow>
            )}
            {consumableEntries.map(entry => (
              <TableRow key={entry.clientId}>
                <TableCell>
                  <input
                    value={entry.consumableName}
                    onChange={event => handleConsumableChange(entry.clientId, 'consumableName', event.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    placeholder="예: 울쎄라 팁"
                    disabled={baselineLocked}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <input
                    value={entry.purchaseCost === 0 ? '' : entry.purchaseCost}
                    onChange={event => handleConsumableChange(entry.clientId, 'purchaseCost', event.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-right"
                    placeholder="0"
                    disabled={baselineLocked}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <input
                    value={entry.yieldQuantity === 0 ? '' : entry.yieldQuantity}
                    onChange={event => handleConsumableChange(entry.clientId, 'yieldQuantity', event.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-right"
                    placeholder="1"
                    disabled={baselineLocked}
                  />
                </TableCell>
                <TableCell>
                  <input
                    value={entry.unit}
                    onChange={event => handleConsumableChange(entry.clientId, 'unit', event.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    placeholder="예: shots"
                    disabled={baselineLocked}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (baselineLocked) {
                        return;
                      }
                      removeConsumableRow(entry.clientId);
                    }}
                    className="text-sm text-red-500 hover:underline"
                    disabled={baselineLocked}
                  >
                    삭제
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSaveConsumables}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          disabled={baselineLocked || consumableSaving || !selectedBaselineId || !consumableDirty}
        >
          {consumableSaving ? '저장 중...' : '소모품 단가 저장'}
        </button>
      </div>
    </div>
  );

  const renderConfigurationTabs = () => {
    const tabs: { key: 'staff' | 'consumables'; label: string; dirty: boolean }[] = [
      { key: 'staff', label: '인력 설정', dirty: staffDirty },
      { key: 'consumables', label: '소모품 단가', dirty: consumableDirty },
    ];

    return (
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            {tabs.map(tab => {
              const isActive = tab.key === activeTab;
              const baseTabClasses = 'rounded-md px-3 py-2 text-sm font-medium transition';
              const tabClasses = isActive
                ? baseTabClasses + ' bg-blue-600 text-white shadow-sm'
                : baseTabClasses + ' text-gray-600 hover:text-gray-900 hover:bg-gray-100';

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={tabClasses}
                  aria-pressed={isActive}
                >
                  <span>{tab.label}</span>
                  {tab.dirty && (
                    <span className="ml-2 inline-flex items-center text-xs font-semibold text-orange-500">
                      ●<span className="sr-only">저장하지 않은 변경사항</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-4">
          {activeTab === 'staff' ? renderStaffContent() : renderConsumableContent()}
        </div>
      </section>
    );
  };

  const renderFixedCostSection = () => (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">고정비 반영</h3>
          <p className="text-sm text-gray-500">
            반영할 고정비를 선택하고 필요 시 항목별로 포함 여부를 조정하세요.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={fixedCostInclude}
              onChange={event => handleToggleFixedCostInclude(event.target.checked)}
              disabled={baselineLocked}
              className="h-4 w-4"
            />
            고정비 반영
          </label>
          <div className="text-sm text-gray-600">
            선택 {includedCount}개 · 합계 {formatCurrency(totalSelectedFixedCost)}
          </div>
          <button
            type="button"
            onClick={handleSaveFixedCosts}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            disabled={baselineLocked || fixedCostSaving || !selectedBaselineId || !fixedCostDirty}
          >
            {fixedCostSaving ? '저장 중...' : '고정비 설정 저장'}
          </button>
        </div>
      </header>

      {!fixedCostItems.length ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">
          등록된 고정비 항목이 없습니다. 고정비 모듈에서 항목을 추가하면 이곳에서 선택할 수 있습니다.
        </div>
      ) : (
        <div className={`overflow-x-auto ${!fixedCostInclude ? 'opacity-60' : ''}`}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32 text-center">반영</TableHead>
                <TableHead>항목명</TableHead>
                <TableHead className="w-40 text-right">월 비용 (원)</TableHead>
                <TableHead className="w-32 text-center">기본값</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fixedCostItems.map(item => (
                <TableRow key={item.templateId}>
                  <TableCell className="text-center">
                    <input
                      type="checkbox"
                      checked={item.included && fixedCostInclude}
                      onChange={() => handleToggleFixedCostItem(item.templateId)}
                      disabled={baselineLocked || !fixedCostInclude}
                      className="h-4 w-4"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900">{item.name}</span>
                      <span className="text-xs text-gray-500">템플릿 ID: {item.templateId}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(item.monthlyCost)}</TableCell>
                  <TableCell className="text-center">
                    {item.defaultIncluded ? '기본 포함' : '선택'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {baselineLocked && (
        <p className="mt-4 rounded-md bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
          기준월이 잠금 상태입니다. 고정비 선택을 변경하려면 먼저 잠금을 해제하세요.
        </p>
      )}
      {!fixedCostInclude && fixedCostItems.length > 0 && (
        <p className="mt-4 rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-600">
          고정비 반영이 비활성화되어 있어 이번 기준월 계산에서는 고정비가 제외됩니다.
        </p>
      )}
    </section>
  );

  if (!baselines.length && !selectedBaseline && !loading) {
    return (
      <CostingPlaceholder
        title="기본 설정"
        description="기준월을 생성하고 인력/소모품 데이터를 입력해 원가 계산을 준비하세요."
      />
    );
  }

  return (
    <div className="space-y-6">
      {renderBaselineControls()}
      {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      {formMessage && <div className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-600">{formMessage}</div>}
      {selectedBaseline ? (
        <>
          {renderFixedCostSection()}
          {renderConfigurationTabs()}
        </>
      ) : (
        <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">
          기준월을 선택하면 인력 및 소모품 편집 기능을 사용할 수 있습니다.
        </div>
      )}
    </div>
  );
};

export default CostingBasePage;
