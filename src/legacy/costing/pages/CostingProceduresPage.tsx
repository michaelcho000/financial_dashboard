// Deprecated: legacy costing procedures editor retained for reference only.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/Table';
import { useCostingBaselines } from '../../../contexts/CostingBaselineContext';
import { useCostingServices } from '../../../contexts/CostingServicesContext';
import {
  ProcedureSummary,
  ProcedureVariantInput,
  ProcedureStaffMixInput,
  ProcedureConsumableUsageInput,
  ProcedureEquipmentLinkInput,
} from '../../../services/costing/types';

const createClientId = () => 'tmp-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now();

const normaliseNumber = (value: string, fallback = 0): number => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return fallback;
  }
  const numeric = Number(trimmed.replace(/,/g, ''));
  return Number.isFinite(numeric) ? numeric : fallback;
};

interface EditableStaffMix extends ProcedureStaffMixInput {
  clientId: string;
}

interface EditableConsumableUsage extends ProcedureConsumableUsageInput {
  clientId: string;
}

interface EditableEquipmentLink extends ProcedureEquipmentLinkInput {
  clientId: string;
}

interface VariantDraft {
  variantId: string;
  label: string;
  salePrice: number;
  totalMinutes: number;
  staffMix: EditableStaffMix[];
  consumables: EditableConsumableUsage[];
  equipmentLinks: EditableEquipmentLink[];
}

const CostingProceduresPage: React.FC = () => {
  const { selectedBaselineId, selectedBaseline, loading: baselineLoading } = useCostingBaselines();
  const { procedureDataService } = useCostingServices();

  const [procedures, setProcedures] = useState<ProcedureSummary[]>([]);
  const [selectedProcedureId, setSelectedProcedureId] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'staff' | 'consumables' | 'equipment'>('basic');

  const [variantDraft, setVariantDraft] = useState<VariantDraft | null>(null);
  const [variantDirty, setVariantDirty] = useState(false);
  const [variantSaving, setVariantSaving] = useState(false);
  const [variantMessage, setVariantMessage] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baselineLocked = selectedBaseline?.status === 'LOCKED';

  const loadProcedures = useCallback(async () => {
    if (!selectedBaselineId) {
      setProcedures([]);
      setSelectedProcedureId(null);
      setSelectedVariantId(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await procedureDataService.listProcedures(selectedBaselineId);
      setProcedures(list);
      setSelectedProcedureId(prev => {
        if (prev && list.some(item => item.procedureId === prev)) {
          return prev;
        }
        return list.length ? list[0].procedureId : null;
      });
    } catch (err) {
      console.error('[Costing] Failed to load procedures', err);
      setError(err instanceof Error ? err.message : '시술 정보를 불러오지 못했습니다.');
      setProcedures([]);
      setSelectedProcedureId(null);
      setSelectedVariantId(null);
    } finally {
      setLoading(false);
    }
  }, [procedureDataService, selectedBaselineId]);

  useEffect(() => {
    loadProcedures();
  }, [loadProcedures]);

  const selectedProcedure = useMemo(() => {
    if (!selectedProcedureId) {
      return null;
    }
    return procedures.find(item => item.procedureId === selectedProcedureId) ?? null;
  }, [procedures, selectedProcedureId]);

  useEffect(() => {
    if (!selectedProcedure) {
      setSelectedVariantId(null);
      setVariantDraft(null);
      setVariantDirty(false);
      return;
    }
    if (!selectedProcedure.variants.length) {
      setSelectedVariantId(null);
      setVariantDraft(null);
      setVariantDirty(false);
      return;
    }
    setSelectedVariantId(prev => {
      if (prev && selectedProcedure.variants.some(variant => variant.variantId === prev)) {
        return prev;
      }
      return selectedProcedure.variants[0].variantId;
    });
  }, [selectedProcedure]);

  const selectedVariant = useMemo(() => {
    if (!selectedProcedure || !selectedVariantId) {
      return null;
    }
    return selectedProcedure.variants.find(variant => variant.variantId === selectedVariantId) ?? null;
  }, [selectedProcedure, selectedVariantId]);

  useEffect(() => {
    if (!selectedVariant) {
      setVariantDraft(null);
      setVariantDirty(false);
      return;
    }
    const draft: VariantDraft = {
      variantId: selectedVariant.variantId,
      label: selectedVariant.label,
      salePrice: selectedVariant.salePrice,
      totalMinutes: selectedVariant.totalMinutes,
      staffMix: selectedVariant.staffMix.map(entry => ({
        clientId: createClientId(),
        ...entry,
      })),
      consumables: selectedVariant.consumables.map(entry => ({
        clientId: createClientId(),
        ...entry,
      })),
      equipmentLinks: selectedVariant.equipmentLinks.map(entry => ({
        clientId: createClientId(),
        ...entry,
      })),
    };
    setVariantDraft(draft);
    setVariantDirty(false);
    setActiveTab('basic');
  }, [selectedVariant]);

  const confirmVariantNavigation = useCallback(() => {
    if (!variantDirty) {
      return true;
    }
    return window.confirm('저장하지 않은 변경사항이 있습니다. 이동하시겠습니까?');
  }, [variantDirty]);

  const handleProcedureSelect = (procedureId: string) => {
    if (procedureId === selectedProcedureId) {
      return;
    }
    if (!confirmVariantNavigation()) {
      return;
    }
    setVariantMessage(null);
    setSelectedProcedureId(procedureId);
  };

  const handleVariantSelect = (variantId: string) => {
    if (variantId === selectedVariantId) {
      return;
    }
    if (!confirmVariantNavigation()) {
      return;
    }
    setVariantMessage(null);
    setSelectedVariantId(variantId || null);
  };

  const updateVariantDraft = (updater: (draft: VariantDraft) => VariantDraft) => {
    setVariantDraft(prev => {
      if (!prev) {
        return prev;
      }
      return updater(prev);
    });
  };

  const handleVariantFieldChange = (field: 'label' | 'salePrice' | 'totalMinutes', value: string) => {
    setVariantDirty(true);
    if (field === 'label') {
      updateVariantDraft(prev => ({ ...prev, label: value }));
      return;
    }
    const numeric = normaliseNumber(value, 0);
    updateVariantDraft(prev => ({ ...prev, [field]: numeric }));
  };

  const updateStaffMix = (clientId: string, patch: Partial<ProcedureStaffMixInput>) => {
    updateVariantDraft(prev => ({
      ...prev,
      staffMix: prev.staffMix.map(entry => (entry.clientId === clientId ? { ...entry, ...patch } : entry)),
    }));
  };

  const handleStaffRoleChange = (clientId: string, value: string) => {
    setVariantDirty(true);
    updateStaffMix(clientId, { roleName: value });
  };

  const handleStaffParticipantsChange = (clientId: string, value: string) => {
    setVariantDirty(true);
    const numeric = Math.max(0, normaliseNumber(value, 0));
    updateStaffMix(clientId, { participants: numeric });
  };

  const handleStaffMinutesChange = (clientId: string, value: string) => {
    setVariantDirty(true);
    const numeric = Math.max(0, normaliseNumber(value, 0));
    updateStaffMix(clientId, { minutes: numeric });
  };

  const handleStaffRemove = (clientId: string) => {
    setVariantDirty(true);
    updateVariantDraft(prev => ({
      ...prev,
      staffMix: prev.staffMix.filter(entry => entry.clientId !== clientId),
    }));
  };

  const handleAddStaffRow = () => {
    if (!variantDraft) {
      return;
    }
    setVariantDirty(true);
    const next: EditableStaffMix = {
      clientId: createClientId(),
      roleName: '',
      participants: 1,
      minutes: 0,
    };
    updateVariantDraft(prev => ({
      ...prev,
      staffMix: [...prev.staffMix, next],
    }));
  };

  const updateConsumable = (clientId: string, patch: Partial<ProcedureConsumableUsageInput>) => {
    updateVariantDraft(prev => ({
      ...prev,
      consumables: prev.consumables.map(entry => (entry.clientId === clientId ? { ...entry, ...patch } : entry)),
    }));
  };

  const handleConsumableNameChange = (clientId: string, value: string) => {
    setVariantDirty(true);
    updateConsumable(clientId, { consumableName: value });
  };

  const handleConsumableQuantityChange = (clientId: string, value: string) => {
    setVariantDirty(true);
    const numeric = Math.max(0, normaliseNumber(value, 0));
    updateConsumable(clientId, { quantity: numeric });
  };

  const handleConsumableUnitChange = (clientId: string, value: string) => {
    setVariantDirty(true);
    updateConsumable(clientId, { unit: value });
  };

  const handleConsumableRemove = (clientId: string) => {
    setVariantDirty(true);
    updateVariantDraft(prev => ({
      ...prev,
      consumables: prev.consumables.filter(entry => entry.clientId !== clientId),
    }));
  };

  const handleAddConsumableRow = () => {
    if (!variantDraft) {
      return;
    }
    setVariantDirty(true);
    const next: EditableConsumableUsage = {
      clientId: createClientId(),
      consumableName: '',
      quantity: 1,
      unit: '',
    };
    updateVariantDraft(prev => ({
      ...prev,
      consumables: [...prev.consumables, next],
    }));
  };

  const updateEquipmentLink = (clientId: string, patch: Partial<ProcedureEquipmentLinkInput>) => {
    updateVariantDraft(prev => ({
      ...prev,
      equipmentLinks: prev.equipmentLinks.map(entry => (entry.clientId === clientId ? { ...entry, ...patch } : entry)),
    }));
  };

  const handleEquipmentTemplateChange = (clientId: string, value: string) => {
    setVariantDirty(true);
    updateEquipmentLink(clientId, { fixedCostTemplateId: value });
  };

  const handleEquipmentNotesChange = (clientId: string, value: string) => {
    setVariantDirty(true);
    updateEquipmentLink(clientId, { notes: value });
  };

  const handleEquipmentRemove = (clientId: string) => {
    setVariantDirty(true);
    updateVariantDraft(prev => ({
      ...prev,
      equipmentLinks: prev.equipmentLinks.filter(entry => entry.clientId !== clientId),
    }));
  };

  const handleAddEquipmentRow = () => {
    if (!variantDraft) {
      return;
    }
    setVariantDirty(true);
    const next: EditableEquipmentLink = {
      clientId: createClientId(),
      fixedCostTemplateId: '',
      notes: '',
    };
    updateVariantDraft(prev => ({
      ...prev,
      equipmentLinks: [...prev.equipmentLinks, next],
    }));
  };
  const handleSaveVariant = async () => {
    if (!selectedBaselineId || !variantDraft) {
      setVariantMessage('기준월 또는 시술 변형을 찾을 수 없습니다.');
      return;
    }
    setVariantSaving(true);
    setVariantMessage(null);
    try {
      const payload: ProcedureVariantInput = {
        variantId: variantDraft.variantId,
        label: variantDraft.label.trim(),
        salePrice: variantDraft.salePrice,
        totalMinutes: variantDraft.totalMinutes,
        staffMix: variantDraft.staffMix
          .filter(entry => entry.roleName.trim().length > 0)
          .map(({ clientId, ...rest }) => ({
            ...rest,
            participants: Math.max(rest.participants, 0),
            minutes: Math.max(rest.minutes, 0),
          })),
        consumables: variantDraft.consumables
          .filter(entry => entry.consumableName.trim().length > 0)
          .map(({ clientId, ...rest }) => ({ ...rest })),
        equipmentLinks: variantDraft.equipmentLinks
          .filter(entry => entry.fixedCostTemplateId.trim().length > 0)
          .map(({ clientId, ...rest }) => ({ ...rest })),
      };

      await procedureDataService.updateProcedureVariant(selectedBaselineId, variantDraft.variantId, payload);
      await loadProcedures();
      setVariantMessage('시술 변형을 저장했습니다.');
      setVariantDirty(false);
    } catch (err) {
      console.error('[Costing] Failed to save procedure variant', err);
      setVariantMessage(err instanceof Error ? err.message : '시술 변형 저장에 실패했습니다.');
    } finally {
      setVariantSaving(false);
    }
  };
  if (!selectedBaseline && !baselineLoading) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">기준월을 먼저 선택하세요</h2>
        <p className="mt-3 text-sm text-gray-600">
          상단의 기준월 선택기를 사용하면 해당 월의 시술 마스터 데이터를 불러옵니다.
        </p>
        <p className="mt-1 text-sm text-gray-500">
          /income-statement에서 해당 월의 재무 데이터를 등록해야 편집이 열립니다.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(240px,320px)_1fr]">
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">시술 목록</h2>
            <p className="text-sm text-gray-500">기준월에 포함된 시술과 변형을 선택하세요.</p>
          </div>
          <button
            type="button"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
            disabled
            aria-disabled="true"
            title="추후 업데이트 예정"
          >
            시술 추가 예정
          </button>
        </header>

        {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="mt-4 space-y-2">
          {loading ? (
            <p className="text-sm text-gray-500">시술 정보를 불러오는 중입니다...</p>
          ) : procedures.length === 0 ? (
            <p className="text-sm text-gray-500">등록된 시술이 없습니다. 추후 업데이트에서 추가할 수 있습니다.</p>
          ) : (
            <ul className="space-y-2">
              {procedures.map(item => {
                const isActive = item.procedureId === selectedProcedureId;
                const baseClasses = 'w-full rounded-md border px-3 py-2 text-left text-sm transition';
                const activeClasses = isActive
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-blue-200 hover:bg-blue-50';
                const combinedClasses = baseClasses + ' ' + activeClasses;
                return (
                  <li key={item.procedureId}>
                    <button
                      type="button"
                      onClick={() => handleProcedureSelect(item.procedureId)}
                      className={combinedClasses}
                    >
                      <span className="block font-medium">{item.name}</span>
                      <span className="mt-1 block text-xs text-gray-500">변형 {item.variants.length}개</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        {!selectedProcedure ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            시술을 선택하면 상세 구성을 확인할 수 있습니다.
          </div>
        ) : selectedProcedure.variants.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            등록된 변형이 없습니다. 추후 업데이트에서 변형 추가 기능을 제공합니다.
          </div>
        ) : !variantDraft ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            변형 정보를 불러오는 중입니다...
          </div>
        ) : (
          <div className="space-y-6">
            <header className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{selectedProcedure.name}</h2>
                  <p className="text-sm text-gray-500">
                    변형 {selectedProcedure.variants.length}개 · 인력/소모품/장비 구성을 편집하세요.
                  </p>
                </div>
                <div className="flex flex-col items-start gap-2 text-sm text-gray-600 md:flex-row md:items-center">
                  <label className="font-medium text-gray-700" htmlFor="variant-select">
                    변형 선택
                  </label>
                  <select
                    id="variant-select"
                    value={selectedVariantId ?? ''}
                    onChange={event => handleVariantSelect(event.target.value)}
                    className="w-48 rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    {selectedProcedure.variants.map(variant => (
                      <option key={variant.variantId} value={variant.variantId}>
                        {variant.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {variantMessage && (
                <div className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-600">{variantMessage}</div>
              )}
              {baselineLocked && (
                <div className="rounded-md bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
                  기준월이 잠금 상태입니다. 내용을 확인할 수는 있지만 수정하려면 잠금을 해제해야 합니다.
                </div>
              )}
            </header>

            <div className="rounded-lg border border-gray-200">
              <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-600">
                {(
                  [
                    { key: 'basic', label: '기본 정보' },
                    { key: 'staff', label: '인력 구성' },
                    { key: 'consumables', label: '소모품 사용' },
                    { key: 'equipment', label: '장비 연결' },
                  ] as const
                ).map(tab => {
                  const isActive = activeTab === tab.key;
                  const base = 'rounded-md px-3 py-2 transition';
                  const styles = isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900';
                  const buttonClasses = base + ' ' + styles;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={buttonClasses}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="p-5">
                {activeTab === 'basic' && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="flex flex-col gap-2 text-sm text-gray-700">
                      <span className="font-medium">변형 이름</span>
                      <input
                        value={variantDraft.label}
                        onChange={event => handleVariantFieldChange('label', event.target.value)}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                        placeholder="예: 기본 패키지"
                        disabled={baselineLocked}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-gray-700">
                      <span className="font-medium">판매가 (원)</span>
                      <input
                        value={variantDraft.salePrice === 0 ? '' : variantDraft.salePrice}
                        onChange={event => handleVariantFieldChange('salePrice', event.target.value)}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm text-right"
                        placeholder="0"
                        disabled={baselineLocked}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-gray-700">
                      <span className="font-medium">총 소요 시간 (분)</span>
                      <input
                        value={variantDraft.totalMinutes === 0 ? '' : variantDraft.totalMinutes}
                        onChange={event => handleVariantFieldChange('totalMinutes', event.target.value)}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm text-right"
                        placeholder="0"
                        disabled={baselineLocked}
                      />
                    </label>
                  </div>
                )}

                {activeTab === 'staff' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-gray-700">역할별 구성</h3>
                      <button
                        type="button"
                        onClick={handleAddStaffRow}
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
                            <TableHead className="w-32 text-right">참여 수</TableHead>
                            <TableHead className="w-40 text-right">투입 시간(분)</TableHead>
                            <TableHead className="w-24 text-center">삭제</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {variantDraft.staffMix.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-sm text-gray-500">
                                등록된 인력 구성이 없습니다. 행 추가를 눌러 입력하세요.
                              </TableCell>
                            </TableRow>
                          ) : (
                            variantDraft.staffMix.map(entry => (
                              <TableRow key={entry.clientId}>
                                <TableCell>
                                  <input
                                    value={entry.roleName}
                                    onChange={event => handleStaffRoleChange(entry.clientId, event.target.value)}
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                                    placeholder="예: 의사"
                                    disabled={baselineLocked}
                                  />
                                </TableCell>
                                <TableCell className="text-right">
                                  <input
                                    value={entry.participants === 0 ? '' : entry.participants}
                                    onChange={event => handleStaffParticipantsChange(entry.clientId, event.target.value)}
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-right"
                                    placeholder="0"
                                    disabled={baselineLocked}
                                  />
                                </TableCell>
                                <TableCell className="text-right">
                                  <input
                                    value={entry.minutes === 0 ? '' : entry.minutes}
                                    onChange={event => handleStaffMinutesChange(entry.clientId, event.target.value)}
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-right"
                                    placeholder="0"
                                    disabled={baselineLocked}
                                  />
                                </TableCell>
                                <TableCell className="text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleStaffRemove(entry.clientId)}
                                    className="text-sm text-red-500 hover:underline"
                                    disabled={baselineLocked}
                                  >
                                    삭제
                                  </button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {activeTab === 'consumables' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-gray-700">소모품 사용</h3>
                      <button
                        type="button"
                        onClick={handleAddConsumableRow}
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
                            <TableHead className="w-36 text-right">사용 수량</TableHead>
                            <TableHead className="w-32">단위</TableHead>
                            <TableHead className="w-24 text-center">삭제</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {variantDraft.consumables.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-sm text-gray-500">
                                등록된 소모품 사용 정보가 없습니다. 행 추가를 눌러 입력하세요.
                              </TableCell>
                            </TableRow>
                          ) : (
                            variantDraft.consumables.map(entry => (
                              <TableRow key={entry.clientId}>
                                <TableCell>
                                  <input
                                    value={entry.consumableName}
                                    onChange={event => handleConsumableNameChange(entry.clientId, event.target.value)}
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                                    placeholder="예: 울쎄라 팁"
                                    disabled={baselineLocked}
                                  />
                                </TableCell>
                                <TableCell className="text-right">
                                  <input
                                    value={entry.quantity === 0 ? '' : entry.quantity}
                                    onChange={event => handleConsumableQuantityChange(entry.clientId, event.target.value)}
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-right"
                                    placeholder="0"
                                    disabled={baselineLocked}
                                  />
                                </TableCell>
                                <TableCell>
                                  <input
                                    value={entry.unit}
                                    onChange={event => handleConsumableUnitChange(entry.clientId, event.target.value)}
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                                    placeholder="예: shots"
                                    disabled={baselineLocked}
                                  />
                                </TableCell>
                                <TableCell className="text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleConsumableRemove(entry.clientId)}
                                    className="text-sm text-red-500 hover:underline"
                                    disabled={baselineLocked}
                                  >
                                    삭제
                                  </button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {activeTab === 'equipment' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-gray-700">장비 연결</h3>
                      <button
                        type="button"
                        onClick={handleAddEquipmentRow}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
                        disabled={baselineLocked}
                      >
                        행 추가
                      </button>
                    </div>
                    <div className="space-y-3">
                      {variantDraft.equipmentLinks.length === 0 ? (
                        <p className="text-sm text-gray-500">연결된 장비가 없습니다. 행 추가를 눌러 장비 템플릿을 연결하세요.</p>
                      ) : (
                        variantDraft.equipmentLinks.map(entry => (
                          <div key={entry.clientId} className="grid gap-3 rounded-md border border-gray-200 p-4 md:grid-cols-2">
                            <label className="flex flex-col gap-2 text-sm text-gray-700">
                              <span className="font-medium">고정비 템플릿 ID</span>
                              <input
                                value={entry.fixedCostTemplateId}
                                onChange={event => handleEquipmentTemplateChange(entry.clientId, event.target.value)}
                                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                                placeholder="예: FC-001"
                                disabled={baselineLocked}
                              />
                            </label>
                            <label className="flex flex-col gap-2 text-sm text-gray-700">
                              <span className="font-medium">비고</span>
                              <input
                                value={entry.notes ?? ''}
                                onChange={event => handleEquipmentNotesChange(entry.clientId, event.target.value)}
                                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                                placeholder="장비 사용 메모"
                                disabled={baselineLocked}
                              />
                            </label>
                            <div className="md:col-span-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleEquipmentRemove(entry.clientId)}
                                className="text-sm text-red-500 hover:underline"
                                disabled={baselineLocked}
                              >
                                연결 해제
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveVariant}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                disabled={baselineLocked || !variantDraft || !variantDirty || variantSaving}
              >
                {variantSaving ? '저장 중...' : '변형 저장'}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default CostingProceduresPage;
