import React, { useEffect, useMemo, useState } from 'react';
import { buildProcedureBreakdown, calculateMonthlyFixedTotal } from '../../../services/standaloneCosting/calculations';
import { MaterialUsage, ProcedureFormValues, StaffAssignment } from '../../../services/standaloneCosting/types';
import { useStandaloneCosting } from '../state/StandaloneCostingProvider';
import { formatKrw, formatPercentage, formatNumberInput, parseNumberInput } from '../../../utils/formatters';
import { generateId } from '../../../utils/id';
import ConfirmationModal from '../../../components/common/ConfirmationModal';
import WizardModal from '../../../components/common/WizardModal';
import HelpTooltip from './HelpTooltip';

interface ProcedureFormState {
  id: string | null;
  name: string;
  price: string;
  treatmentMinutes: string;
  totalMinutes: string;
  notes: string;
}

interface AssignmentFormState {
  staffId: string;
  minutes: string;
}

interface MaterialUsageFormState {
  materialId: string;
  quantity: string;
}

const emptyProcedureForm: ProcedureFormState = {
  id: null,
  name: '',
  price: '',
  treatmentMinutes: '',
  totalMinutes: '',
  notes: '',
};

const parseNumber = (value: string): number | null => {
  if (!value.trim()) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const parsePositive = (value: string): number | null => {
  const numeric = parseNumber(value);
  if (numeric === null || numeric <= 0) {
    return null;
  }
  return numeric;
};

const normalizeNotes = (value: string | null | undefined): string => {
  if (!value) {
    return '';
  }
  return value.replace(/\r\n/g, '\n').replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
};

interface ProcedureManagementSectionProps {
  editProcedureId?: string | null;
  onEditComplete?: () => void;
}

const ProcedureManagementSection: React.FC<ProcedureManagementSectionProps> = ({ editProcedureId, onEditComplete }) => {
  const { state, upsertProcedure, removeProcedure } = useStandaloneCosting();
  const [form, setForm] = useState<ProcedureFormState>(emptyProcedureForm);
  const [staffAssignments, setStaffAssignments] = useState<AssignmentFormState[]>([]);
  const [materialUsages, setMaterialUsages] = useState<MaterialUsageFormState[]>([]);
  const [newStaffId, setNewStaffId] = useState<string>('');
  const [newStaffMinutes, setNewStaffMinutes] = useState<string>('0');
  const [newMaterialId, setNewMaterialId] = useState<string>('');
  const [newMaterialQuantity, setNewMaterialQuantity] = useState<string>('1');
  const [pendingProcedure, setPendingProcedure] = useState<ProcedureFormValues | null>(null);
  const [warnNoMaterial, setWarnNoMaterial] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // 카탈로그에서 편집 버튼 클릭 시 해당 시술 로드
  useEffect(() => {
    if (editProcedureId) {
      const procedure = state.procedures.find(p => p.id === editProcedureId);
      if (procedure) {
        setForm({
          id: procedure.id,
          name: procedure.name,
          price: String(procedure.price ?? ''),
          treatmentMinutes: String(procedure.treatmentMinutes ?? ''),
          totalMinutes: String(procedure.totalMinutes ?? ''),
          notes: normalizeNotes(procedure.notes),
        });
        setStaffAssignments(procedure.staffAssignments.map(item => ({ staffId: item.staffId, minutes: String(item.minutes) })));
        setMaterialUsages(procedure.materialUsages.map(item => ({ materialId: item.materialId, quantity: String(item.quantity) })));
        setIsWizardOpen(true);
      }
      if (onEditComplete) {
        onEditComplete();
      }
    }
  }, [editProcedureId, state.procedures, onEditComplete]);

  useEffect(() => {
    if (newStaffId && !state.staff.some(candidate => candidate.id === newStaffId)) {
      setNewStaffId('');
    }
  }, [newStaffId, state.staff]);

  useEffect(() => {
    if (newMaterialId && !state.materials.some(candidate => candidate.id === newMaterialId)) {
      setNewMaterialId('');
    }
  }, [newMaterialId, state.materials]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    // 금액 필드는 콤마를 제거한 순수 숫자만 저장
    if (name === 'price') {
      setForm(prev => ({ ...prev, [name]: parseNumberInput(value) }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const resetForm = () => {
    setForm(emptyProcedureForm);
    setStaffAssignments([]);
    setMaterialUsages([]);
    setNewStaffId('');
    setNewStaffMinutes('0');
    setNewMaterialId('');
    setNewMaterialQuantity('1');
  };

  const openWizard = () => {
    resetForm();
    setIsWizardOpen(true);
  };

  const closeWizard = () => {
    setIsWizardOpen(false);
    resetForm();
  };

  const handleAddStaff = () => {
    if (!newStaffId) {
      return;
    }
    const minutes = parsePositive(newStaffMinutes) ?? 0;
    const exists = staffAssignments.findIndex(item => item.staffId === newStaffId);
    if (exists >= 0) {
      setStaffAssignments(prev => prev.map(item => (item.staffId === newStaffId ? { ...item, minutes: String(minutes) } : item)));
    } else {
      setStaffAssignments(prev => [...prev, { staffId: newStaffId, minutes: String(minutes) }]);
    }
    setNewStaffId('');
    setNewStaffMinutes('0');
  };

  const handleAssignmentMinutesChange = (staffId: string, value: string) => {
    setStaffAssignments(prev => prev.map(item => (item.staffId === staffId ? { ...item, minutes: value } : item)));
  };

  const handleRemoveStaff = (staffId: string) => {
    setStaffAssignments(prev => prev.filter(item => item.staffId !== staffId));
  };

  const handleAddMaterial = () => {
    if (!newMaterialId) {
      return;
    }
    const quantity = parsePositive(newMaterialQuantity) ?? 0;
    const exists = materialUsages.findIndex(item => item.materialId === newMaterialId);
    if (exists >= 0) {
      setMaterialUsages(prev => prev.map(item => (item.materialId === newMaterialId ? { ...item, quantity: String(quantity) } : item)));
    } else {
      setMaterialUsages(prev => [...prev, { materialId: newMaterialId, quantity: String(quantity) }]);
    }
    setNewMaterialId('');
    setNewMaterialQuantity('1');
  };

  const handleMaterialQuantityChange = (materialId: string, value: string) => {
    setMaterialUsages(prev => prev.map(item => (item.materialId === materialId ? { ...item, quantity: value } : item)));
  };

  const handleRemoveMaterial = (materialId: string) => {
    setMaterialUsages(prev => prev.filter(item => item.materialId !== materialId));
  };

  const toAssignments = (items: AssignmentFormState[]): StaffAssignment[] =>
    items
      .map(item => ({
        staffId: item.staffId,
        minutes: parseNumber(item.minutes) ?? 0,
      }))
      .filter(item => item.minutes > 0);

  const toMaterialUsages = (items: MaterialUsageFormState[]): MaterialUsage[] =>
    items
      .map(item => ({
        materialId: item.materialId,
        quantity: parseNumber(item.quantity) ?? 0,
      }))
      .filter(item => item.quantity > 0);

  const finalizeSave = (payload: ProcedureFormValues) => {
    upsertProcedure(payload);
    resetForm();
    setIsWizardOpen(false);
  };

  const handleWizardComplete = () => {
    const price = parseNumber(form.price) ?? 0;
    const treatmentMinutes = parseNumber(form.treatmentMinutes) ?? 0;
    const totalMinutes = parseNumber(form.totalMinutes) ?? treatmentMinutes;

    const assignments = toAssignments(staffAssignments);
    const materials = toMaterialUsages(materialUsages);
    const normalizedNotes = normalizeNotes(form.notes).trim();

    const payload: ProcedureFormValues = {
      id: form.id ?? generateId(),
      name: form.name.trim(),
      price,
      treatmentMinutes,
      totalMinutes,
      staffAssignments: assignments,
      materialUsages: materials,
      notes: normalizedNotes || undefined,
    };

    if (materials.length === 0) {
      setPendingProcedure(payload);
      setWarnNoMaterial(true);
      return;
    }

    finalizeSave(payload);
  };

  const handleEdit = (procedure: ProcedureFormValues) => {
    setForm({
      id: procedure.id,
      name: procedure.name,
      price: String(procedure.price ?? ''),
      treatmentMinutes: String(procedure.treatmentMinutes ?? ''),
      totalMinutes: String(procedure.totalMinutes ?? ''),
      notes: normalizeNotes(procedure.notes),
    });
    setStaffAssignments(procedure.staffAssignments.map(item => ({ staffId: item.staffId, minutes: String(item.minutes) })));
    setMaterialUsages(procedure.materialUsages.map(item => ({ materialId: item.materialId, quantity: String(item.quantity) })));
    setIsWizardOpen(true);
  };

  const handleDelete = (procedure: ProcedureFormValues) => {
    const confirmed = window.confirm(`${procedure.name} 시술을 삭제하시겠습니까?`);
    if (confirmed) {
      removeProcedure(procedure.id);
      if (form.id === procedure.id) {
        resetForm();
      }
    }
  };

  const previewProcedure: ProcedureFormValues = useMemo(() => {
    const price = parseNumber(form.price) ?? 0;
    const treatmentMinutes = parseNumber(form.treatmentMinutes) ?? 0;
    const totalMinutes = parseNumber(form.totalMinutes) ?? treatmentMinutes;
    const normalizedNotes = normalizeNotes(form.notes).trim();
    return {
      id: form.id ?? 'preview',
      name: form.name.trim() || '미리보기 시술',
      price,
      treatmentMinutes,
      totalMinutes,
      staffAssignments: toAssignments(staffAssignments),
      materialUsages: toMaterialUsages(materialUsages),
      notes: normalizedNotes || undefined,
    };
  }, [form, staffAssignments, materialUsages]);

  const previewBreakdown = useMemo(() => {
    try {
      return buildProcedureBreakdown(previewProcedure, {
        staff: state.staff,
        materials: state.materials,
        fixedCosts: state.fixedCosts,
        operational: state.operational,
      });
    } catch (error) {
      console.error('[StandaloneCosting] Failed to build preview breakdown', error);
      return null;
    }
  }, [previewProcedure, state.staff, state.materials, state.fixedCosts, state.operational]);

  const facilityFixedCost = useMemo(
    () => calculateMonthlyFixedTotal(state.fixedCosts, 'facility'),
    [state.fixedCosts],
  );
  const commonFixedCost = useMemo(
    () => calculateMonthlyFixedTotal(state.fixedCosts, 'common'),
    [state.fixedCosts],
  );

  // Wizard steps 구성
  const wizardSteps = useMemo(() => [
    {
      title: '기본정보',
      content: (
        <div className="space-y-4">
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            시술명
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            판매가 (원)
            <input
              name="price"
              type="text"
              value={formatNumberInput(form.price)}
              onChange={handleChange}
              placeholder="예: 300,000"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              <div className="flex items-center justify-between">
                <span>시술 소요시간 (분)</span>
                <HelpTooltip content="실제 시술만 하는 시간입니다. 마진 분석 참고용으로 사용됩니다." />
              </div>
              <input
                name="treatmentMinutes"
                type="number"
                min={0}
                value={form.treatmentMinutes}
                onChange={handleChange}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <span className="text-xs text-gray-500">
                실제 시술만 하는 시간 (마진 분석 참고용)
              </span>
            </label>

            <label className="flex flex-col gap-1 text-sm text-gray-700">
              <div className="flex items-center justify-between">
                <span>총 체류시간 (분)</span>
                <HelpTooltip content="상담+준비+시술+정리 전체 시간입니다. 고정비 배분은 이 값을 기준으로 계산됩니다." />
              </div>
              <input
                name="totalMinutes"
                type="number"
                min={0}
                value={form.totalMinutes}
                onChange={handleChange}
                placeholder="비워두면 시술 소요시간과 동일하게 설정됩니다"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <span className="text-xs text-gray-500">
                상담+준비+시술+정리 (고정비 배분 기준)
              </span>
            </label>
          </div>

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
        </div>
      ),
    },
    {
      title: '투입 인력',
      content: (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">투입 인력 선택</h3>
            <div className="flex items-center gap-2 text-sm">
              <select
                value={newStaffId}
                onChange={event => setNewStaffId(event.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">인력을 선택하세요</option>
                {state.staff.map(staff => (
                  <option key={staff.id} value={staff.id}>
                    {staff.role} - {staff.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                value={newStaffMinutes}
                onChange={event => setNewStaffMinutes(event.target.value)}
                className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="분"
              />
              <button
                type="button"
                onClick={handleAddStaff}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
              >
                추가
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">인력</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-500">투입 시간 (분)</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staffAssignments.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-center text-gray-400" colSpan={3}>
                      등록된 투입 인력이 없습니다.
                    </td>
                  </tr>
                ) : (
                  staffAssignments.map(item => {
                    const staff = state.staff.find(candidate => candidate.id === item.staffId);
                    return (
                      <tr key={item.staffId} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-900">
                          {staff ? `${staff.role} · ${staff.name}` : '인력을 선택하세요'}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={item.minutes}
                            onChange={event => handleAssignmentMinutesChange(item.staffId, event.target.value)}
                            className="w-24 rounded-md border border-gray-300 px-3 py-1 text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveStaff(item.staffId)}
                            className="rounded-md border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                          >
                            제거
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ),
    },
    {
      title: '소모품 사용',
      content: (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">소모품 사용 선택</h3>
            <div className="flex items-center gap-2 text-sm">
              <select
                value={newMaterialId}
                onChange={event => setNewMaterialId(event.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">소모품을 선택하세요</option>
                {state.materials.map(material => (
                  <option key={material.id} value={material.id}>
                    {material.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                value={newMaterialQuantity}
                onChange={event => setNewMaterialQuantity(event.target.value)}
                className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="수량"
              />
              <button
                type="button"
                onClick={handleAddMaterial}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
              >
                추가
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">소모품</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-500">사용 수량</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {materialUsages.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-center text-gray-400" colSpan={3}>
                      등록된 소모품 사용이 없습니다.
                    </td>
                  </tr>
                ) : (
                  materialUsages.map(item => {
                    const material = state.materials.find(candidate => candidate.id === item.materialId);
                    return (
                      <tr key={item.materialId} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-900">{material ? material.name : '소모품을 선택하세요'}</td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={item.quantity}
                            onChange={event => handleMaterialQuantityChange(item.materialId, event.target.value)}
                            className="w-24 rounded-md border border-gray-300 px-3 py-1 text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveMaterial(item.materialId)}
                            className="rounded-md border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                          >
                            제거
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-md border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
            <div className="mb-2 flex items-center justify-between text-blue-900">
              <span className="font-semibold">원가 미리보기</span>
              <span className="text-xs text-blue-700">시설·운영비 {formatKrw(facilityFixedCost)} 기준</span>
            </div>
            <p className="mb-3 text-xs text-blue-700">
              공통비용 {formatKrw(commonFixedCost)}은 시나리오 탭에서 별도로 검토합니다.
            </p>
            {previewBreakdown ? (
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <div className="flex justify-between">
                    <span>직접 인건비</span>
                    <span className="font-medium">{formatKrw(previewBreakdown.directLaborCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>소모품 비용</span>
                    <span className="font-medium">{formatKrw(previewBreakdown.consumableCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>고정비 배분</span>
                    <span className="font-medium">{formatKrw(previewBreakdown.fixedCostAllocated)}</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between">
                    <span>총 원가</span>
                    <span className="font-semibold">{formatKrw(previewBreakdown.totalCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>마진</span>
                    <span className={previewBreakdown.margin >= 0 ? 'font-semibold text-blue-900' : 'font-semibold text-red-600'}>
                      {formatKrw(previewBreakdown.margin)} ({formatPercentage(previewBreakdown.marginRate)})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>손익분기 건수</span>
                    <span className="font-medium">
                      {previewBreakdown.breakevenUnits !== null
                        ? Math.ceil(previewBreakdown.breakevenUnits).toLocaleString('ko-KR') + '건'
                        : '기여이익이 부족합니다'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p>입력값을 기반으로 원가를 계산하는 중 오류가 발생했습니다.</p>
            )}
          </div>
        </div>
      ),
    },
  ], [form, staffAssignments, materialUsages, state.staff, state.materials, newStaffId, newStaffMinutes, newMaterialId, newMaterialQuantity, handleChange, handleAddStaff, handleAssignmentMinutesChange, handleRemoveStaff, handleAddMaterial, handleMaterialQuantityChange, handleRemoveMaterial, facilityFixedCost, commonFixedCost, previewBreakdown]);

  return (
    <>
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">시술 등록</h2>
            <p className="mt-1 text-sm text-gray-600">판매가와 투입 자원을 입력해 원가를 계산합니다.</p>
          </div>
          <button
            onClick={openWizard}
            className="rounded-md border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            + 시술 등록
          </button>
        </header>

        <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">시술명</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500">판매가</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500">시술 시간</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500">총 체류시간</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {state.procedures.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-gray-400" colSpan={5}>
                  ?깅줉???쒖닠???놁뒿?덈떎.
                </td>
              </tr>
            ) : (
              state.procedures.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{item.name}</td>
                  <td className="px-4 py-2 text-right text-gray-900">{formatKrw(item.price)}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{item.treatmentMinutes.toLocaleString('ko-KR')}분</td>
                  <td className="px-4 py-2 text-right text-gray-600">{item.totalMinutes.toLocaleString('ko-KR')}분</td>
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

      {/* 시술 등록/수정 Wizard Modal */}
      <WizardModal
        isOpen={isWizardOpen}
        onClose={closeWizard}
        title={form.id ? '시술 수정' : '시술 등록'}
        steps={wizardSteps}
        onComplete={handleWizardComplete}
        size="lg"
      />

      {/* 소모품 없음 경고 Modal */}
      <ConfirmationModal
        isOpen={warnNoMaterial}
        title="소모품이 등록되어 있지 않습니다"
        message="소모품이 없는 시술입니다. 등록을 계속 진행하시겠습니까?"
        confirmText="계속 저장"
        cancelText="취소"
        onConfirm={() => {
          if (pendingProcedure) {
            finalizeSave(pendingProcedure);
          }
          setPendingProcedure(null);
          setWarnNoMaterial(false);
        }}
        onCancel={() => {
          setPendingProcedure(null);
          setWarnNoMaterial(false);
        }}
      />
    </>
  );
};

export default ProcedureManagementSection;




