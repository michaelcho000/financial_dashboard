import React from 'react';
import OperationalSettingsSection from './components/OperationalSettingsSection';
import StaffManagementSection from './components/StaffManagementSection';
import MaterialManagementSection from './components/MaterialManagementSection';
import FixedCostManagementSection from './components/FixedCostManagementSection';
import ProcedureManagementSection from './components/ProcedureManagementSection';
import ProcedureResultsSection from './components/ProcedureResultsSection';
import { StandaloneCostingProvider, useStandaloneCosting } from './state/StandaloneCostingProvider';

const StandaloneCostingContent: React.FC = () => {
  const { hydrated } = useStandaloneCosting();

  if (!hydrated) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-gray-200 bg-white p-6">
        <span className="text-sm text-gray-600">데이터를 불러오는 중입니다...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">시술 원가 계산</h1>
        <p className="mt-2 text-sm text-gray-600">
          월별 운영 정보와 인력/소모품 데이터를 기반으로 시술 단위 원가와 마진을 확인하세요.
        </p>
      </section>

      <OperationalSettingsSection />
      <StaffManagementSection />
      <MaterialManagementSection />
      <FixedCostManagementSection />
      <ProcedureManagementSection />
      <ProcedureResultsSection />
    </div>
  );
};

const StandaloneCostingPage: React.FC = () => (
  <StandaloneCostingProvider>
    <StandaloneCostingContent />
  </StandaloneCostingProvider>
);

export default StandaloneCostingPage;
