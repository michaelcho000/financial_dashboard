import React, { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import Header from '../components/Header';
import { useFinancials } from '../contexts/FinancialDataContext';
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
  const { baselines, selectedBaseline, loading, selectBaseline } = useCostingBaselines();
  const { currentMonths, setCurrentMonths } = useFinancials();

  const [primaryMonth] = currentMonths;

  useEffect(() => {
    if (!baselines.length) {
      if (selectedBaseline) {
        selectBaseline(null);
      }
      return;
    }

    if (selectedBaseline?.month === primaryMonth) {
      return;
    }

    if (primaryMonth) {
      const matchingBaseline = baselines.find(baseline => baseline.month === primaryMonth);
      if (matchingBaseline) {
        if (!selectedBaseline || matchingBaseline.id !== selectedBaseline.id) {
          selectBaseline(matchingBaseline.id);
        }
      } else if (selectedBaseline) {
        selectBaseline(null);
      }
    }
  }, [baselines, primaryMonth, selectBaseline, selectedBaseline]);

  useEffect(() => {
    if (!selectedBaseline) {
      return;
    }

    setCurrentMonths(prev => {
      if (prev[0] === selectedBaseline.month && prev[1] === null) {
        return prev;
      }
      return [selectedBaseline.month, null];
    });
  }, [selectedBaseline, setCurrentMonths]);

  useEffect(() => {
    if (!primaryMonth && baselines.length && !selectedBaseline) {
      selectBaseline(baselines[0].id);
    }
  }, [baselines, primaryMonth, selectBaseline, selectedBaseline]);

  const baselineDescription = loading
    ? '기준월 정보를 불러오는 중입니다.'
    : selectedBaseline
        ? `${selectedBaseline.month} · ${statusLabels[selectedBaseline.status]}`
        : primaryMonth
          ? `${primaryMonth}에 대한 기준월이 없습니다.`
          : '기준월을 선택하세요.';

  const handleMonthChange = (nextMonth: string) => {
    const trimmed = nextMonth.trim();
    if (!trimmed) {
      return false;
    }

    const matchingBaseline = baselines.find(baseline => baseline.month === trimmed);
    if (matchingBaseline) {
      if (!selectedBaseline || matchingBaseline.id !== selectedBaseline.id) {
        selectBaseline(matchingBaseline.id);
      }
    } else if (selectedBaseline) {
      selectBaseline(null);
    }

    return true;
  };

  return (
    <div className="space-y-6">
      <Header
        title="원가 계산 인사이트"
        description="월별 기준 데이터를 관리하고 시술 원가 및 인사이트를 준비하세요."
        showMonthSelector
        allowComparisonToggle={false}
        currentMonths={currentMonths}
        setCurrentMonths={setCurrentMonths}
        onStartMonthChange={handleMonthChange}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="text-sm text-gray-600">
          <span className="font-medium text-gray-700">현재 기준월</span>
          <span className="ml-2">{baselineDescription}</span>
        </div>
        <nav className="flex flex-wrap gap-2 border-b border-gray-200 pb-2 lg:border-0 lg:pb-0">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/costing/base'}
              className={({ isActive }) => {
                const baseClasses = 'rounded-md px-3 py-2 text-sm font-medium transition';
                return isActive
                  ? `${baseClasses} bg-blue-600 text-white shadow-sm`
                  : `${baseClasses} text-gray-600 hover:text-gray-900 hover:bg-gray-100`;
              }}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

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
