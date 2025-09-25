import React from 'react';
import { NavLink } from 'react-router-dom';
import { CostingBaselineProvider, useCostingBaselines } from '../contexts/CostingBaselineContext';
import { BaselineStatus } from '../services/costing/types';

const navItems = [
  { path: '/costing/base', label: '기본 설정' },
  { path: '/costing/procedures', label: '시술 설정' },
  { path: '/costing/results', label: '결과 & 인사이트' },
];

const statusLabels: Record<BaselineStatus, string> = {
  DRAFT: '초안',
  READY: '준비됨',
  LOCKED: '잠금',
};

const CostingLayoutShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { selectedBaseline, loading } = useCostingBaselines();

  const baselineDescription = loading
    ? '기준월 정보를 불러오는 중입니다.'
    : selectedBaseline
        ? selectedBaseline.month + ' · ' + statusLabels[selectedBaseline.status]
        : '기준월을 선택하세요.';

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">원가 계산 인사이트</h1>
          <p className="text-sm text-gray-600">
            월별 기준 데이터를 관리하고 시술 원가 및 인사이트를 준비하세요.
          </p>
        </div>
        <div className="text-sm text-gray-600">
          <span className="font-medium text-gray-700">현재 기준월</span>
          <span className="ml-2">{baselineDescription}</span>
        </div>
        <nav className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/costing/base'}
              className={({ isActive }) => {
                const baseClasses = 'rounded-md px-3 py-2 text-sm font-medium transition';
                return isActive
                  ? baseClasses + ' bg-blue-600 text-white shadow-sm'
                  : baseClasses + ' text-gray-600 hover:text-gray-900 hover:bg-gray-100';
              }}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
};

const CostingLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <CostingBaselineProvider>
    <CostingLayoutShell>{children}</CostingLayoutShell>
  </CostingBaselineProvider>
);

export default CostingLayout;
