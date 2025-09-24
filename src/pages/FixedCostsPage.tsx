import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FixedCostActualSnapshot, FixedCostTemplate, FixedCostType } from '../types';
import { formatCurrency } from '../utils/formatters';
import NotificationModal from '../components/common/NotificationModal';
import useSaveNotification from '../hooks/useSaveNotification';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import ConfirmationModal from '../components/common/ConfirmationModal';
import { useFinancials } from '../contexts/FinancialDataContext';
import Header from '../components/Header';

const COST_TYPE_GROUP_LABEL: Record<FixedCostType, string> = {
  ASSET_FINANCE: '리스/금융 자산',
  OPERATING_SERVICE: '운영 서비스 계약',
};

const PAYMENT_DAY_OPTIONS = Array.from({ length: 31 }, (_, index) => String(index + 1));

const normalizePaymentDate = (value?: string): string => {
  if (!value) return '';
  const match = value.match(/(\d{1,2})/);
  if (match) {
    const day = Math.min(Math.max(parseInt(match[1], 10), 1), 31);
    return String(day);
  }
  return '';
};

const formatPaymentDateLabel = (value?: string): string => {
  if (!value) return '-';
  if (/^\d{1,2}$/.test(value)) {
    return `${value}일`;
  }
  const match = value.match(/(\d{1,2})/);
  if (match) {
    return `${parseInt(match[1], 10)}일`;
  }
  return value;
};

const formatMonthLabel = (value: string): string => {
  const [year, month] = value.split('-');
  if (!year || !month) {
    return value;
  }
  const numericMonth = Number(month);
  if (Number.isNaN(numericMonth)) {
    return value;
  }
  return `${year}년 ${numericMonth}월`;
};

type FixedCostModalPayload = {
  templateId?: string;
  accountId?: string;
  serviceName: string;
  vendor: string;
  monthlyCost: number;
  paymentDate?: string;
  contractDetails?: string;
  renewalDate?: string;
  leaseTermMonths?: number;
  contractStartDate?: string;
  contractEndDate?: string;
  costType: FixedCostType;
};

const FixedCostItemModal: React.FC<{
  item?: FixedCostTemplate | null;
  onClose: () => void;
  onSave: (payload: FixedCostModalPayload) => void;
  initialCostType: FixedCostType;
}> = ({ item, onClose, onSave, initialCostType }) => {
  const [costType, setCostType] = useState<FixedCostType>(item?.costType ?? initialCostType);
  const [formData, setFormData] = useState({
    serviceName: '',
    vendor: '',
    monthlyCost: '',
    paymentDate: '',
    contractDetails: '',
    renewalDate: '',
    leaseTermMonths: '',
    contractStartDate: '',
    contractEndDate: '',
  });

  useEffect(() => {
    const normalizedPaymentDate = normalizePaymentDate(item?.paymentDate);

    setCostType(item?.costType ?? initialCostType);
    setFormData({
      serviceName: item?.serviceName ?? '',
      vendor: item?.vendor ?? '',
      monthlyCost: item ? String(item.monthlyCost) : '',
      paymentDate: normalizedPaymentDate,
      contractDetails: item?.contractDetails ?? '',
      renewalDate: item?.renewalDate ?? '',
      leaseTermMonths: item?.leaseTermMonths !== undefined ? String(item.leaseTermMonths) : '',
      contractStartDate: item?.contractStartDate ?? '',
      contractEndDate: item?.contractEndDate ?? '',
    });
  }, [item, initialCostType]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    if (name === 'monthlyCost' || name === 'leaseTermMonths') {
      const numeric = value.replace(/[^0-9]/g, '');
      setFormData(prev => ({ ...prev, [name]: numeric }));
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePaymentDaySelect = (day: string) => {
    setFormData(prev => ({ ...prev, paymentDate: day }));
  };
  const handlePaymentDayClear = () => {
    setFormData(prev => ({ ...prev, paymentDate: '' }));
  };

  const formattedMonthlyCost = formData.monthlyCost
    ? new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(Number(formData.monthlyCost))
    : '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const serviceName = formData.serviceName.trim();
    const vendor = formData.vendor.trim();

    if (!serviceName) {
      alert('고정비 항목명을 입력해주세요.');
      return;
    }
    if (!vendor) {
      alert('업체명을 입력해주세요.');
      return;
    }

    const monthlyCostValue = Number(formData.monthlyCost || '0');
    if (!Number.isFinite(monthlyCostValue) || monthlyCostValue < 0) {
      alert('월 금액은 0 이상 숫자로 입력해주세요.');
      return;
    }

    const leaseTermValue = formData.leaseTermMonths ? Number(formData.leaseTermMonths) : undefined;
    if (formData.leaseTermMonths && (Number.isNaN(leaseTermValue) || leaseTermValue < 0)) {
      alert('계약 기간은 0 이상 숫자로 입력해주세요.');
      return;
    }

    onSave({
      templateId: item?.id,
      accountId: item?.accountId,
      serviceName,
      vendor,
      monthlyCost: monthlyCostValue,
      paymentDate: formData.paymentDate || undefined,
      contractDetails: formData.contractDetails.trim() || undefined,
      renewalDate: formData.renewalDate || undefined,
      leaseTermMonths: leaseTermValue,
      contractStartDate: formData.contractStartDate || undefined,
      contractEndDate: formData.contractEndDate || undefined,
      costType,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b">
            <h3 className="text-xl font-bold">{item ? '고정비 항목 수정' : '고정비 항목 추가'}</h3>
          </div>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">지출 유형</label>
              <select
                value={costType}
                onChange={e => setCostType(e.target.value as FixedCostType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
              >
                <option value="OPERATING_SERVICE">운영 서비스 계약</option>
                <option value="ASSET_FINANCE">리스/금융 자산</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">고정비 항목명</label>
              <input
                type="text"
                name="serviceName"
                value={formData.serviceName}
                onChange={handleInputChange}
                placeholder="예: 본사 관리비"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">업체명</label>
              <input
                type="text"
                name="vendor"
                value={formData.vendor}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">기본 월 금액 (원)</label>
              <input
                type="text"
                name="monthlyCost"
                value={formattedMonthlyCost}
                onChange={handleInputChange}
                placeholder="예: 1500000"
                inputMode="numeric"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-right"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">출금일</label>
              <div className="space-y-2">
                <div className="grid grid-cols-7 gap-2">
                  {PAYMENT_DAY_OPTIONS.map(day => {
                    const isSelected = formData.paymentDate === day;
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => handlePaymentDaySelect(day)}
                        className={`py-2 text-sm rounded-md border transition ${isSelected ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-100'}`}
                        aria-pressed={isSelected}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>
                    {formData.paymentDate ? `${formData.paymentDate}일 선택됨` : '선택된 출금일 없음'}
                  </span>
                  {formData.paymentDate && (
                    <button type="button" onClick={handlePaymentDayClear} className="text-blue-600 hover:text-blue-800">
                      선택 해제
                    </button>
                  )}
                </div>
              </div>
            </div>

            {costType === 'ASSET_FINANCE' ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">계약 시작일</label>
                    <input
                      type="date"
                      name="contractStartDate"
                      value={formData.contractStartDate}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">만기일자</label>
                    <input
                      type="date"
                      name="contractEndDate"
                      value={formData.contractEndDate}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">계약 기간 (개월)</label>
                  <input
                    type="text"
                    name="leaseTermMonths"
                    value={formData.leaseTermMonths}
                    onChange={handleInputChange}
                    placeholder="예: 12"
                    inputMode="numeric"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">갱신 예정일</label>
                  <input
                    type="date"
                    name="renewalDate"
                    value={formData.renewalDate}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">계약 현황</label>
                  <textarea
                    name="contractDetails"
                    value={formData.contractDetails}
                    onChange={handleInputChange}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </>
            )}
          </div>
          <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">취소</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">저장</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const FixedCostsPage: React.FC = () => {
  const { fixed, currentMonths, setCurrentMonths, commitDraft, resetDraft, unsaved, versions, monthMetadata } = useFinancials();
  const { notifySave, notifyCancel, notifyCustom, notificationProps } = useSaveNotification();
  const [activeTab, setActiveTab] = useState<FixedCostType>('ASSET_FINANCE');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FixedCostTemplate | null>(null);
  const [deletionTarget, setDeletionTarget] = useState<FixedCostTemplate | null>(null);
  const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>({});
  const [lastBulkAction, setLastBulkAction] = useState<string | null>(null);

  const currentMonth = currentMonths[0];

  const actualByTemplate = useMemo<Record<string, FixedCostActualSnapshot>>(() => {
    if (!currentMonth) {
      return {};
    }
    return fixed.actualMap[currentMonth] ?? {};
  }, [fixed.actualMap, currentMonth]);

  const previousMonthWithData = useMemo(() => {
    if (!currentMonth) {
      return null;
    }
    const candidates = monthMetadata
      .filter(meta => meta.month < currentMonth && (meta.hasDraftData || meta.hasCommittedData))
      .map(meta => meta.month)
      .sort();
    if (candidates.length === 0) {
      return null;
    }
    return candidates[candidates.length - 1];
  }, [currentMonth, monthMetadata]);

  const disableBulkActions = !currentMonth;

  const clearAmountDrafts = useCallback(() => {
    setAmountDrafts({});
  }, []);

  const handleApplyTemplateDefaults = () => {
    if (!currentMonth) {
      return;
    }
    fixed.templates.forEach(template => {
      const current = actualByTemplate[template.id];
      const nextIsActive = template.monthlyCost > 0 ? true : (current?.isActive ?? false);
      fixed.upsertActual(currentMonth, template.id, {
        amount: template.monthlyCost,
        isActive: nextIsActive,
      });
    });
    clearAmountDrafts();
    setLastBulkAction('템플릿 기본 금액을 적용했습니다.');
    notifyCustom('기본 월 금액 적용', '템플릿 기본 금액을 현재 월 초안에 반영했습니다. 변경사항 저장을 완료하면 손익에 반영됩니다.');
  };

  const handleApplyPreviousMonth = () => {
    if (!currentMonth) {
      return;
    }
    if (!previousMonthWithData) {
      setLastBulkAction('이전 월에 복사할 고정비 데이터가 없습니다.');
      notifyCustom('이전 월 데이터 없음', '이전 월에 저장된 고정비 데이터가 없어 복사할 수 없습니다.');
      return;
    }
    const sourceActuals = fixed.actualMap[previousMonthWithData] ?? {};
    fixed.templates.forEach(template => {
      const source = sourceActuals[template.id];
      fixed.upsertActual(currentMonth, template.id, {
        amount: source ? source.amount : 0,
        isActive: source ? source.isActive : false,
      });
    });
    clearAmountDrafts();
    setLastBulkAction(`${formatMonthLabel(previousMonthWithData)} 데이터를 복사했습니다.`);
    notifyCustom('이전 월 금액 적용', `${formatMonthLabel(previousMonthWithData)} 데이터를 현재 월에 복사했습니다. 변경사항 저장을 완료하면 손익에 반영됩니다.`);
  };

  const handleResetCurrentMonth = () => {
    if (!currentMonth) {
      return;
    }
    fixed.templates.forEach(template => {
      fixed.upsertActual(currentMonth, template.id, { amount: 0, isActive: false });
    });
    clearAmountDrafts();
    setLastBulkAction('현재 월 고정비 금액을 초기화했습니다.');
    notifyCustom('기본 월 금액 초기화', '현재 월의 고정비 금액을 0으로 초기화했습니다. 저장을 완료하면 보고서에서도 반영이 사라집니다.');
  };

  const handleToggleAllActive = (nextActive: boolean) => {
    if (!currentMonth) {
      return;
    }
    fixed.templates.forEach(template => {
      fixed.upsertActual(currentMonth, template.id, { isActive: nextActive });
    });
    if (nextActive) {
      setLastBulkAction('모든 고정비 항목을 월반영으로 전환했습니다.');
      notifyCustom('월반영 전체 ON', '현재 월의 모든 고정비 항목을 월반영으로 전환했습니다. 저장을 완료하면 손익에 반영됩니다.');
    } else {
      setLastBulkAction('모든 고정비 항목을 월반영 해제했습니다.');
      notifyCustom('월반영 전체 OFF', '현재 월의 모든 고정비 항목이 손익 계산과 상세 목록에서 숨겨집니다. 저장을 완료하면 반영됩니다.');
    }
  };

  const filteredTemplates = useMemo(
    () => fixed.templates.filter(item => item.costType === activeTab),
    [fixed.templates, activeTab],
  );

  const handleCommitChanges = () => {
    if (!unsaved.fixed) {
      return;
    }
    commitDraft();
    clearAmountDrafts();
    setLastBulkAction('변경사항을 저장했습니다.');
    notifySave('고정비 데이터를 저장했습니다.');
  };

  const handleCancelChanges = () => {
    if (!unsaved.fixed) {
      return;
    }
    resetDraft();
    clearAmountDrafts();
    setLastBulkAction('변경사항을 취소했습니다.');
    notifyCancel('고정비 변경사항을 취소했습니다.');
  };

  useEffect(() => {
    clearAmountDrafts();
  }, [versions.draft, clearAmountDrafts]);

  useEffect(() => {
    setLastBulkAction(null);
  }, [currentMonth]);

  const handleSaveTemplate = (payload: FixedCostModalPayload) => {
    const groupLabel = COST_TYPE_GROUP_LABEL[payload.costType];

    if (payload.templateId && payload.accountId) {
      fixed.updateTemplate(payload.templateId, {
        accountId: payload.accountId,
        costType: payload.costType,
        serviceName: payload.serviceName,
        vendor: payload.vendor,
        monthlyCost: payload.monthlyCost,
        paymentDate: payload.paymentDate,
        contractDetails: payload.contractDetails,
        renewalDate: payload.renewalDate,
        leaseTermMonths: payload.leaseTermMonths,
        contractStartDate: payload.contractStartDate,
        contractEndDate: payload.contractEndDate,
      });
      fixed.updateAccount(payload.accountId, {
        name: payload.serviceName,
        group: groupLabel,
      });
      setAmountDrafts(prev => {
        if (!payload.templateId || !(payload.templateId in prev)) return prev;
        const next = { ...prev };
        delete next[payload.templateId];
        return next;
      });
    } else {
      const accountId = fixed.createAccount(payload.serviceName, payload.costType);
      const newTemplateId = fixed.addTemplate({
        accountId,
        costType: payload.costType,
        serviceName: payload.serviceName,
        vendor: payload.vendor,
        monthlyCost: payload.monthlyCost,
        paymentDate: payload.paymentDate,
        contractDetails: payload.contractDetails,
        renewalDate: payload.renewalDate,
        leaseTermMonths: payload.leaseTermMonths,
        contractStartDate: payload.contractStartDate,
        contractEndDate: payload.contractEndDate,
      });
      if (currentMonth) {
        fixed.upsertActual(currentMonth, newTemplateId, {
          amount: payload.monthlyCost,
          isActive: true,
        });
      }
    }

    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleAmountChange = (templateId: string, value: string) => {
    const numericString = value.replace(/[^0-9]/g, '');
    setAmountDrafts(prev => ({ ...prev, [templateId]: numericString }));
    setLastBulkAction('고정비 금액을 직접 수정했습니다.');
  };

  const commitAmount = (template: FixedCostTemplate) => {
    if (!currentMonth) return;

    const rawValue = amountDrafts[template.id];
    const numeric = rawValue === undefined || rawValue === '' ? NaN : Number(rawValue);

    if (Number.isNaN(numeric)) {
      setAmountDrafts(prev => {
        const next = { ...prev };
        delete next[template.id];
        return next;
      });
      return;
    }

    fixed.upsertActual(currentMonth, template.id, { amount: numeric });
    setAmountDrafts(prev => {
      const next = { ...prev };
      delete next[template.id];
      return next;
    });
  };

  const handleToggleActive = (template: FixedCostTemplate, nextActive: boolean) => {
    if (!currentMonth) return;
    fixed.upsertActual(currentMonth, template.id, { isActive: nextActive });
    setLastBulkAction(
      nextActive
        ? `"${template.serviceName}" 항목을 월반영으로 전환했습니다.`
        : `"${template.serviceName}" 항목을 월반영에서 제외했습니다.`,
    );
    if (!nextActive) {
      notifyCustom(
        '월반영 해제',
        `"${template.serviceName}" 항목은 이 월의 손익 계산과 상세 목록에서 숨겨집니다. 다시 표시하려면 월반영을 켜주세요.`,
      );
    }
  };

  const getRemainingMonths = (endDate: string) => {
    if (!endDate) return { months: Infinity, text: '-' };
    const end = new Date(endDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (Number.isNaN(end.getTime())) return { months: Infinity, text: '-' };
    if (end < now) return { months: 0, text: '만료' };

    const months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
    return { months, text: `${months}개월 남음` };
  };

  const getStatusBadge = (remainingMonths: number) => {
    if (remainingMonths <= 0) return <span className="px-2 py-1 text-xs font-semibold text-red-800 bg-red-100 rounded-full">만료</span>;
    if (remainingMonths <= 3) return <span className="px-2 py-1 text-xs font-semibold text-yellow-800 bg-yellow-100 rounded-full">만료 임박</span>;
    if (remainingMonths === Infinity) return null;
    return <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded-full">진행중</span>;
  };

  return (
    <>
      <Header
        title="고정비 및 계약 관리"
        description="리스, 금융 자산 및 운영 서비스 계약 정보를 관리합니다."
        allowComparisonToggle={false}
        actions={(
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
              className="px-4 py-2 rounded-md text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700"
            >
              + 고정비 항목 추가
            </button>
            <button
              type="button"
              onClick={handleCancelChanges}
              disabled={!unsaved.fixed}
              className={`px-4 py-2 rounded-md text-sm font-semibold ${unsaved.fixed ? 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
            >
              변경 취소
            </button>
            <button
              type="button"
              onClick={handleCommitChanges}
              disabled={!unsaved.fixed}
              className={`px-4 py-2 rounded-md text-sm font-semibold ${unsaved.fixed ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
            >
              변경사항 저장
            </button>
          </div>
        )}
        showMonthSelector
        currentMonths={currentMonths}
        setCurrentMonths={setCurrentMonths}
      />

      <div className="mt-6 flex flex-wrap gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleApplyTemplateDefaults}
            disabled={disableBulkActions}
            className={`px-4 py-2 rounded-md text-sm font-semibold ${disableBulkActions ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
          >
            기본 월 금액 적용
          </button>
          <button
            type="button"
            onClick={handleApplyPreviousMonth}
            disabled={disableBulkActions}
            className={`px-4 py-2 rounded-md text-sm font-semibold ${disableBulkActions ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'}`}
          >
            이전 월 금액 복사
          </button>
          <button
            type="button"
            onClick={handleResetCurrentMonth}
            disabled={disableBulkActions}
            className={`px-4 py-2 rounded-md text-sm font-semibold ${disableBulkActions ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'}`}
          >
            기본 월 금액 초기화
          </button>
          <button
            type="button"
            onClick={() => handleToggleAllActive(true)}
            disabled={disableBulkActions}
            className={`px-4 py-2 rounded-md text-sm font-semibold ${disableBulkActions ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'}`}
          >
            월반영 전체 ON
          </button>
          <button
            type="button"
            onClick={() => handleToggleAllActive(false)}
            disabled={disableBulkActions}
            className={`px-4 py-2 rounded-md text-sm font-semibold ${disableBulkActions ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'}`}
          >
            월반영 전체 OFF
          </button>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('ASSET_FINANCE')}
            className={`py-3 px-1 border-b-2 font-semibold text-base ${activeTab === 'ASSET_FINANCE' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            리스/금융 자산
          </button>
          <button
            onClick={() => setActiveTab('OPERATING_SERVICE')}
            className={`py-3 px-1 border-b-2 font-semibold text-base ${activeTab === 'OPERATING_SERVICE' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            운영 서비스 계약
          </button>
        </nav>
        {lastBulkAction && (
          <p className="text-sm text-gray-600 text-right md:min-w-[200px]">{lastBulkAction}</p>
        )}
      </div>

      <div className="mt-4 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {activeTab === 'ASSET_FINANCE' ? (
                <>
                  <TableHead>자산명</TableHead>
                  <TableHead>업체명</TableHead>
                  <TableHead>만기일자</TableHead>
                  <TableHead>계약기간</TableHead>
                  <TableHead>남은 기간</TableHead>
                </>
              ) : (
                <>
                  <TableHead>서비스명</TableHead>
                  <TableHead>업체명</TableHead>
                  <TableHead>계약 현황</TableHead>
                  <TableHead className="text-center">출금일</TableHead>
                  <TableHead className="text-center">갱신 예정일</TableHead>
                </>
              )}
              <TableHead className="text-right">기본 월 금액 (원)</TableHead>
              <TableHead className="text-right">{currentMonth} 금액 (원)</TableHead>
              <TableHead className="text-center">월 반영</TableHead>
              <TableHead className="text-center">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTemplates.map(template => {
              const actual = actualByTemplate[template.id];
              const remaining = getRemainingMonths(template.contractEndDate || '');
              const draftValue = amountDrafts[template.id];
              const baseAmount = actual?.amount ?? template.monthlyCost;
              const rawAmount = draftValue !== undefined ? draftValue : (baseAmount !== undefined ? String(baseAmount) : '');
              const displayAmount = rawAmount ? `₩${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(Number(rawAmount))}` : '';
              const isActive = actual ? actual.isActive : true;
              const paymentLabel = formatPaymentDateLabel(template.paymentDate);

              return (
                <TableRow key={template.id} className="group">
                  {activeTab === 'ASSET_FINANCE' ? (
                    <>
                      <TableCell className="font-medium">{template.serviceName}</TableCell>
                      <TableCell>{template.vendor}</TableCell>
                      <TableCell>{template.contractEndDate || '-'}</TableCell>
                      <TableCell className="w-32">{template.leaseTermMonths ? `${template.leaseTermMonths}개월` : '-'}</TableCell>
                      <TableCell className="w-32">{remaining.text}</TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="font-medium">{template.serviceName}</TableCell>
                      <TableCell>{template.vendor}</TableCell>
                      <TableCell>{template.contractDetails || '-'}</TableCell>
                      <TableCell className="text-center">{paymentLabel}</TableCell>
                      <TableCell className="text-center">{template.renewalDate || '-'}</TableCell>
                    </>
                  )}
                  <TableCell className="text-right">{formatCurrency(template.monthlyCost)}</TableCell>
                  <TableCell className="text-right">
                    <input
                      type="text"
                      value={displayAmount}
                      onChange={e => handleAmountChange(template.id, e.target.value)}
                      onBlur={() => commitAmount(template)}
                      disabled={!currentMonth}
                      className="w-32 text-right border border-transparent focus:border-blue-400 rounded px-2 py-1"
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={e => handleToggleActive(template, e.target.checked)}
                      disabled={!currentMonth}
                    />
                  </TableCell>
                  <TableCell className="text-center w-24">
                    <div className="flex justify-center space-x-2 opacity-0 group-hover:opacity-100">
                      <button onClick={() => { setEditingItem(template); setIsModalOpen(true); }} className="text-gray-400 hover:text-blue-500">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
                      </button>
                      <button onClick={() => setDeletionTarget(template)} className="text-gray-400 hover:text-red-500 text-xl font-bold">&times;</button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {filteredTemplates.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            해당 유형의 고정비 항목이 없습니다.
          </div>
        )}
      </div>

      {isModalOpen && (
        <FixedCostItemModal
          item={editingItem}
          onClose={() => { setIsModalOpen(false); setEditingItem(null); }}
          onSave={handleSaveTemplate}
          initialCostType={activeTab}
        />
      )}

      {deletionTarget && (
        <ConfirmationModal
          isOpen={!!deletionTarget}
          title="고정비 항목 삭제 확인"
          message={`'${deletionTarget.serviceName}' 항목을 정말 삭제하시겠습니까? 해당 항목과 월별 실적이 삭제됩니다.`}
          onConfirm={() => {
            fixed.removeTemplate(deletionTarget.id);
            setDeletionTarget(null);
          }}
          onCancel={() => setDeletionTarget(null)}
        />
      )}
      <NotificationModal {...notificationProps} />
    </>
  );
};

export default FixedCostsPage;
