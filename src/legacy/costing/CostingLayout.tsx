// Deprecated: legacy costing layout retained for reference only.
import React, { useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import Header from '../../components/Header';
import { useFinancials } from '../../contexts/FinancialDataContext';
import { CostingBaselineProvider, useCostingBaselines } from '../../contexts/CostingBaselineContext';
import { BaselineStatus } from '../../services/costing/types';

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
  const { currentMonths, setCurrentMonths, statement } = useFinancials();

  const [primaryMonth] = currentMonths;
  const availableMonths = statement.availableMonths;
  const hasStatementData = primaryMonth ? availableMonths.includes(primaryMonth) : false;

  useEffect(() => {
    if (!hasStatementData) {
      if (selectedBaseline) {
        selectBaseline(null);
      }
      return;
    }

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
  }, [baselines, hasStatementData, primaryMonth, selectBaseline, selectedBaseline]);

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
    if (!hasStatementData || selectedBaseline || !baselines.length) {
      return;
    }
    selectBaseline(baselines[0].id);
  }, [baselines, hasStatementData, selectBaseline, selectedBaseline]);

  const baselineDescription = loading
    ? '기준월 정보를 불러오는 중입니다.'
    : selectedBaseline
        ? `${selectedBaseline.month} · ${statusLabels[selectedBaseline.status]}`
        : !hasStatementData && primaryMonth
          ? `${primaryMonth}에는 손익 보고서 데이터가 없습니다.`
          : primaryMonth
            ? `${primaryMonth}에 대한 기준월을 아직 만들지 않았습니다.`
            : '기준월을 선택하거나 생성하세요.';

  const handleMonthChange = (nextMonth: string) => {
    const trimmed = nextMonth.trim();
    if (!trimmed) {
      return false;
    }

    if (!availableMonths.includes(trimmed)) {
      if (selectedBaseline) {
        selectBaseline(null);
      }
      return true;
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
        description="기준월을 기준으로 인력·소모품·시술 데이터를 관리하고 결과를 확인하세요."
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
        <nav
          className={`flex flex-wrap gap-2 border-b border-gray-200 pb-2 lg:border-0 lg:pb-0 ${
            hasStatementData ? '' : 'pointer-events-none opacity-50'
          }`}
          aria-disabled={!hasStatementData}
        >
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

      {hasStatementData ? (
        children
      ) : (
        <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-800">
          <p className="font-medium">
            손익 보고서에 저장된 데이터가 없는 월입니다.
          </p>
          <p className="mt-2">
            {primaryMonth
              ? `${primaryMonth} 월의 손익 데이터를 먼저 작성하고 저장해야 원가 계산을 진행할 수 있습니다.`
              : '손익 데이터를 작성한 월을 선택하면 원가 계산 기능이 열립니다.'}
          </p>
          <p className="mt-4 text-xs text-amber-700">
            손익 보고서 작성 후 다시 이 화면으로 돌아오면 해당 월의 기준월 생성과 CRUD를 바로 진행할 수 있습니다.
          </p>
          <Link
            to="/income-statement"
            className="mt-4 inline-flex items-center justify-center rounded-md border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
          >
            손익 보고서로 이동
          </Link>
        </div>
      )}
    </div>
  );
};

const CostingLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <CostingBaselineProvider>
    <CostingLayoutShell>{children}</CostingLayoutShell>
  </CostingBaselineProvider>
);

export default CostingLayout;
