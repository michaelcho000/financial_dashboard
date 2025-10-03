import React, { useMemo, useState } from 'react';
import NotificationModal from '../../components/common/NotificationModal';
import OperationalAndEquipmentSection from './components/OperationalAndEquipmentSection';
import StaffManagementSection from './components/StaffManagementSection';
import MaterialManagementSection from './components/MaterialManagementSection';
import FixedCostManagementSection from './components/FixedCostManagementSection';
import ProcedureManagementSection from './components/ProcedureManagementSection';
import ProcedureResultsSection from './components/ProcedureResultsSection';
import ProcedureCatalogSection from './components/ProcedureCatalogSection';
import MarketingInsightsSection from './components/MarketingInsightsSection';
import { StandaloneCostingProvider, useStandaloneCosting } from './state/StandaloneCostingProvider';

interface TabDefinition {
  id: string;
  label: string;
  render: React.ReactNode;
  completion?: () => boolean;
  incompleteMessage?: string;
}

const StandaloneCostingContent: React.FC = () => {
  const { hydrated, state } = useStandaloneCosting();
  const [activeTab, setActiveTab] = useState<string>('operational');
  const [modalMessage, setModalMessage] = useState<string | null>(null);
  const [editProcedureId, setEditProcedureId] = useState<string | null>(null);

  const hasOperationalConfig = useMemo(
    () => state.operational.operatingDays !== null && state.operational.operatingHoursPerDay !== null,
    [state.operational.operatingDays, state.operational.operatingHoursPerDay],
  );

  const tabs: TabDefinition[] = useMemo(
    () => [
      {
        id: 'operational',
        label: '운영 세팅',
        render: (
          <div className="space-y-6">
            <OperationalAndEquipmentSection />
          </div>
        ),
        completion: () => hasOperationalConfig,
        incompleteMessage: '운영 세팅을 먼저 저장하세요.',
      },
      {
        id: 'staff',
        label: '인력 관리',
        render: <StaffManagementSection />,
        completion: () => state.staff.length > 0,
        incompleteMessage: '최소 1명의 인력을 등록하세요.',
      },
      {
        id: 'materials',
        label: '소모품 관리',
        render: <MaterialManagementSection />,
        completion: () => state.materials.length > 0,
        incompleteMessage: '최소 1개의 소모품을 등록하세요.',
      },
      {
        id: 'fixed-costs',
        label: '고정비 관리',
        render: <FixedCostManagementSection />,
        completion: () => state.fixedCosts.length > 0,
        incompleteMessage: '최소 1개의 고정비를 등록하세요.',
      },
      {
        id: 'procedures',
        label: '시술 관리',
        render: (
          <ProcedureManagementSection
            editProcedureId={editProcedureId}
            onEditComplete={() => setEditProcedureId(null)}
          />
        ),
      },
      {
        id: 'catalog',
        label: '시술 카탈로그',
        render: (
          <ProcedureCatalogSection
            onEdit={(procedureId) => {
              setEditProcedureId(procedureId);
              setActiveTab('procedures');
            }}
          />
        ),
        completion: () => state.procedures.length > 0,
        incompleteMessage: '시술을 먼저 등록하세요.',
      },
      {
        id: 'results',
        label: '결과 대시보드',
        render: <ProcedureResultsSection />,
        completion: () => state.procedures.length > 0,
        incompleteMessage: '시술을 먼저 등록하세요.',
      },
      {
        id: 'marketing',
        label: '마케팅 인사이트',
        render: <MarketingInsightsSection />,
        completion: () => state.procedures.length > 0,
        incompleteMessage: '시술 데이터를 먼저 등록하면 마케팅 인사이트 분석을 준비할 수 있습니다.',
      },
    ],
    [hasOperationalConfig, state.fixedCosts.length, state.materials.length, state.procedures.length, state.staff.length],
  );

  const activeIndex = useMemo(() => tabs.findIndex(tab => tab.id === activeTab), [tabs, activeTab]);

  const handleTabSelect = (nextTabId: string) => {
    const nextIndex = tabs.findIndex(tab => tab.id === nextTabId);
    if (nextIndex === -1 || nextIndex === activeIndex) {
      return;
    }

    if (nextIndex > 0) {
      for (let i = 0; i < nextIndex; i += 1) {
        const prerequisite = tabs[i];
        if (prerequisite.completion && !prerequisite.completion()) {
          setModalMessage(prerequisite.incompleteMessage ?? '이전 단계를 먼저 완료하세요.');
          setActiveTab(prerequisite.id);
          return;
        }
      }
    }

    setActiveTab(nextTabId);
  };

  if (!hydrated) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-gray-200 bg-white p-6">
        <span className="text-sm text-gray-600">데이터를 불러오는 중입니다...</span>
      </div>
    );
  }

  const safeIndex = activeIndex >= 0 ? activeIndex : 0;
  const activeTabDefinition = tabs[safeIndex];

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">시술 원가 계산</h1>
        <p className="mt-2 text-sm text-gray-600">
          월별 운영 정보와 인력/소모품 데이터를 기반으로 시술 단위 원가와 마진을 확인하세요.
        </p>
      </section>

      <nav className="flex flex-wrap gap-2">
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTabDefinition.id;
          const prerequisiteSatisfied =
            index === 0 || tabs.slice(0, index).every(step => !step.completion || step.completion());

          const baseClasses =
            'rounded-md border px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-100';
          const activeClasses = 'border-blue-600 bg-blue-600 text-white shadow-sm';
          const inactiveClasses = 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50';
          const pendingClasses = prerequisiteSatisfied ? '' : 'opacity-60';

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabSelect(tab.id)}
              className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses} ${pendingClasses}`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div>{activeTabDefinition.render}</div>

      <NotificationModal
        isOpen={modalMessage !== null}
        onClose={() => setModalMessage(null)}
        message={modalMessage ?? ''}
      />
    </div>
  );
};

const StandaloneCostingPage: React.FC = () => (
  <StandaloneCostingProvider>
    <StandaloneCostingContent />
  </StandaloneCostingProvider>
);

export default StandaloneCostingPage;
