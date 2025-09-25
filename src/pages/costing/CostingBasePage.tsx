import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from '../../components/ui/Table';
import { useCostingSnapshots } from '../../contexts/CostingSnapshotContext';
import { useCostingServices } from '../../contexts/CostingServicesContext';
import {
  ConsumablePricingInput,
  StaffCapacityInput,
  SnapshotCreatePayload,
  SnapshotStatus,
} from '../../services/costing/types';

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
    snapshots,
    selectedSnapshotId,
    selectedSnapshot,
    selectSnapshot,
    createSnapshot,
    updateSnapshot,
    loading,
    error,
  } = useCostingSnapshots();
  const { staffDataService, consumableDataService, calculationService } = useCostingServices();

  const [staffEntries, setStaffEntries] = useState<EditableStaff[]>([]);
  const [consumableEntries, setConsumableEntries] = useState<EditableConsumable[]>([]);
  const [staffSaving, setStaffSaving] = useState(false);
  const [consumableSaving, setConsumableSaving] = useState(false);
  const [recalcState, setRecalcState] = useState<'idle' | 'running' | 'done'>('idle');
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const [newMonth, setNewMonth] = useState('');
  const [newIncludeFixed, setNewIncludeFixed] = useState(true);
  const [newSourceSnapshotId, setNewSourceSnapshotId] = useState<string | null>(null);

  const loadSnapshotData = useCallback(async () => {
    if (!selectedSnapshotId) {
      setStaffEntries([]);
      setConsumableEntries([]);
      return;
    }
    try {
      const [staff, consumables] = await Promise.all([
        staffDataService.getStaff(selectedSnapshotId),
        consumableDataService.getConsumables(selectedSnapshotId),
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
    } catch (err) {
      console.error('[Costing] Failed to load staff/consumable data', err);
      setFormMessage('기준월 데이터를 불러오지 못했습니다. 페이지를 새로고침 해주세요.');
    }
  }, [selectedSnapshotId, staffDataService, consumableDataService]);

  useEffect(() => {
    loadSnapshotData();
  }, [loadSnapshotData]);

  const handleCreateSnapshot = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newMonth) {
      setFormMessage('생성할 월을 입력해주세요. 예: 2025-03');
      return;
    }
    const payload: SnapshotCreatePayload = {
      month: newMonth,
      includeFixedCosts: newIncludeFixed,
      sourceSnapshotId: newSourceSnapshotId,
    };
    try {
      await createSnapshot(payload);
      setFormMessage('기준월을 생성했습니다.');
      setNewMonth('');
      setNewSourceSnapshotId(null);
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
  };

  const removeStaffRow = (clientId: string) => {
    setStaffEntries(prev => prev.filter(entry => entry.clientId !== clientId));
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
  };

  const removeConsumableRow = (clientId: string) => {
    setConsumableEntries(prev => prev.filter(entry => entry.clientId !== clientId));
  };

  const handleSaveStaff = async () => {
    if (!selectedSnapshotId) {
      setFormMessage('선택된 기준월이 없습니다.');
      return;
    }
    setStaffSaving(true);
    setFormMessage(null);
    try {
      const payload: StaffCapacityInput[] = staffEntries
        .filter(entry => entry.roleName.trim().length > 0)
        .map(({ clientId, ...rest }) => ({ ...rest }));
      await staffDataService.upsertStaff(selectedSnapshotId, payload);
      setFormMessage('인력 설정을 저장했습니다.');
    } catch (err) {
      console.error('[Costing] Failed to save staff', err);
      setFormMessage(err instanceof Error ? err.message : '인력 설정 저장에 실패했습니다.');
    } finally {
      setStaffSaving(false);
    }
  };

  const handleSaveConsumables = async () => {
    if (!selectedSnapshotId) {
      setFormMessage('선택된 기준월이 없습니다.');
      return;
    }
    setConsumableSaving(true);
    setFormMessage(null);
    try {
      const payload: ConsumablePricingInput[] = consumableEntries
        .filter(entry => entry.consumableName.trim().length > 0)
        .map(({ clientId, ...rest }) => ({ ...rest }));
      await consumableDataService.upsertConsumables(selectedSnapshotId, payload);
      setFormMessage('소모품 단가를 저장했습니다.');
    } catch (err) {
      console.error('[Costing] Failed to save consumables', err);
      setFormMessage(err instanceof Error ? err.message : '소모품 단가 저장에 실패했습니다.');
    } finally {
      setConsumableSaving(false);
    }
  };

  const handleRecalculate = async () => {
    if (!selectedSnapshotId) {
      setFormMessage('선택된 기준월이 없습니다.');
      return;
    }
    setRecalcState('running');
    setFormMessage(null);
    try {
      await calculationService.recalculate(selectedSnapshotId);
      setRecalcState('done');
      setFormMessage('원가 계산을 완료했습니다. 결과 화면에서 확인할 수 있습니다.');
      await loadSnapshotData();
    } catch (err) {
      console.error('[Costing] Failed to recalculate', err);
      setFormMessage(err instanceof Error ? err.message : '원가 계산에 실패했습니다.');
      setRecalcState('idle');
    }
  };

  useEffect(() => {
    setRecalcState('idle');
  }, [selectedSnapshotId]);

  useEffect(() => {
    setFormMessage(null);
  }, [selectedSnapshotId]);

  const selectedStatusLabel: string = useMemo(() => {
    if (!selectedSnapshot) return '';
    const labels: Record<SnapshotStatus, string> = {
      DRAFT: '초안',
      READY: '준비됨',
      LOCKED: '잠금',
    };
    return labels[selectedSnapshot.status];
  }, [selectedSnapshot]);

  const renderSnapshotControls = () => (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">기준월 관리</h2>
          <p className="text-sm text-gray-500">월별 데이터를 선택하거나 새 기준월을 생성하세요.</p>
        </div>
        <form className="flex flex-col gap-2 md:flex-row md:items-end" onSubmit={handleCreateSnapshot}>
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
              value={newSourceSnapshotId ?? ''}
              onChange={event => setNewSourceSnapshotId(event.target.value || null)}
              className="mt-1 w-40 rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">(선택 안 함)</option>
              {snapshots.map(snapshot => (
                <option key={snapshot.id} value={snapshot.id}>
                  {snapshot.month}
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
            value={selectedSnapshotId ?? ''}
            onChange={event => selectSnapshot(event.target.value || null)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">기준월 선택</option>
            {snapshots.map(snapshot => (
              <option key={snapshot.id} value={snapshot.id}>
                {snapshot.month} · {snapshot.status}
              </option>
            ))}
          </select>
          {selectedSnapshot && (
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
              상태: {selectedStatusLabel}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {selectedSnapshot && (
            <>
              <button
                type="button"
                onClick={() => updateSnapshot(selectedSnapshot.id, { includeFixedCosts: !selectedSnapshot.includeFixedCosts })}
                className="rounded-md border border-gray-300 px-3 py-2 text-xs text-gray-600 hover:bg-gray-100"
              >
                고정비 {selectedSnapshot.includeFixedCosts ? '포함' : '미포함'} 전환
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

      {selectedSnapshot && (
        <dl className="mt-4 grid gap-4 text-sm text-gray-600 sm:grid-cols-3">
          <div>
            <dt className="font-medium text-gray-700">선택한 월</dt>
            <dd>{selectedSnapshot.month}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-700">마지막 계산</dt>
            <dd>{selectedSnapshot.lastCalculatedAt ? new Date(selectedSnapshot.lastCalculatedAt).toLocaleString() : '미실행'}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-700">고정비 반영</dt>
            <dd>{selectedSnapshot.includeFixedCosts ? '포함' : '제외'}</dd>
          </div>
        </dl>
      )}
    </section>
  );

  const renderStaffSection = () => (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">인력 설정</h3>
          <p className="text-sm text-gray-500">역할별 월 급여와 가용 시간을 입력하세요.</p>
        </div>
        <button
          type="button"
          onClick={addStaffRow}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
        >
          행 추가
        </button>
      </header>

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
                  />
                </TableCell>
                <TableCell className="text-right">
                  <input
                    value={entry.monthlyPayroll === 0 ? '' : entry.monthlyPayroll}
                    onChange={event => handleStaffChange(entry.clientId, 'monthlyPayroll', event.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-right"
                    placeholder="0"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <input
                    value={entry.availableMinutes === 0 ? '' : entry.availableMinutes}
                    onChange={event => handleStaffChange(entry.clientId, 'availableMinutes', event.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-right"
                    placeholder="0"
                  />
                </TableCell>
                <TableCell className="text-center">
                  <button
                    type="button"
                    onClick={() => removeStaffRow(entry.clientId)}
                    className="text-sm text-red-500 hover:underline"
                  >
                    삭제
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={handleSaveStaff}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          disabled={staffSaving || !selectedSnapshotId}
        >
          {staffSaving ? '저장 중...' : '인력 설정 저장'}
        </button>
      </div>
    </section>
  );

  const renderConsumableSection = () => (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">소모품 단가</h3>
          <p className="text-sm text-gray-500">구매 단가와 사용 단위를 입력하세요.</p>
        </div>
        <button
          type="button"
          onClick={addConsumableRow}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
        >
          행 추가
        </button>
      </header>

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
                  />
                </TableCell>
                <TableCell className="text-right">
                  <input
                    value={entry.purchaseCost === 0 ? '' : entry.purchaseCost}
                    onChange={event => handleConsumableChange(entry.clientId, 'purchaseCost', event.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-right"
                    placeholder="0"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <input
                    value={entry.yieldQuantity === 0 ? '' : entry.yieldQuantity}
                    onChange={event => handleConsumableChange(entry.clientId, 'yieldQuantity', event.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-right"
                    placeholder="1"
                  />
                </TableCell>
                <TableCell>
                  <input
                    value={entry.unit}
                    onChange={event => handleConsumableChange(entry.clientId, 'unit', event.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    placeholder="예: shots"
                  />
                </TableCell>
                <TableCell className="text-center">
                  <button
                    type="button"
                    onClick={() => removeConsumableRow(entry.clientId)}
                    className="text-sm text-red-500 hover:underline"
                  >
                    삭제
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={handleSaveConsumables}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          disabled={consumableSaving || !selectedSnapshotId}
        >
          {consumableSaving ? '저장 중...' : '소모품 단가 저장'}
        </button>
      </div>
    </section>
  );

  if (!snapshots.length && !selectedSnapshot && !loading) {
    return (
      <CostingPlaceholder
        title="기본 설정"
        description="기준월을 생성하고 인력/소모품 데이터를 입력해 원가 계산을 준비하세요."
      />
    );
  }

  return (
    <div className="space-y-6">
      {renderSnapshotControls()}
      {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      {formMessage && <div className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-600">{formMessage}</div>}
      {selectedSnapshot ? (
        <>
          {renderStaffSection()}
          {renderConsumableSection()}
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
