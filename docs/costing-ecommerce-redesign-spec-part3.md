# 시술 원가 계산 모듈 - 구현 명세 3부: 컴포넌트 상세 명세

> **연결 문서**: `costing-ecommerce-redesign-complete-spec.md` 1부, `costing-ecommerce-redesign-spec-part2.md` 2부

---

## 6. 컴포넌트 구조

### 6.1 전체 컴포넌트 트리

```
StandaloneCostingPage
├── StandaloneCostingProvider (Context)
│   └── StandaloneCostingContent
│       ├── Header Section
│       ├── Tab Navigation
│       └── Tab Content
│           ├── OperationalSettingsSection (운영 세팅)
│           ├── EquipmentManagementSection (장비 관리 - 준비 중)
│           ├── StaffManagementSection (인력 관리)
│           ├── MaterialManagementSection (소모품 관리)
│           ├── FixedCostManagementSection (고정비 관리)
│           ├── ProcedureManagementSection (시술 등록)
│           │   ├── ProcedureForm
│           │   ├── ProcedurePreview
│           │   └── ProcedureList
│           ├── ProcedureCatalogSection (시술 카탈로그 - 신규)
│           │   └── ProcedureCard[]
│           ├── ProcedureResultsSection (결과 대시보드)
│           │   ├── StatCard[]
│           │   ├── MarginChart (신규)
│           │   └── ProcedureTable
│           └── MarketingInsightsSection (마케팅 인사이트)
└── NotificationModal
```

### 6.2 신규 컴포넌트 목록

| 컴포넌트명 | 파일 경로 | 역할 |
|----------|---------|------|
| `ProcedureCatalogSection` | `components/ProcedureCatalogSection.tsx` | 시술 카드 그리드 |
| `ProcedureCard` | `components/ProcedureCard.tsx` | 개별 시술 카드 |
| `MarginBadge` | `components/MarginBadge.tsx` | 마진율 상태 배지 |
| `StatCard` | `components/StatCard.tsx` | 통계 카드 |
| `Alert` | `components/Alert.tsx` | 경고/안내 메시지 |
| `HelpTooltip` | `components/HelpTooltip.tsx` | 도움말 툴팁 |
| `MarginChart` | `components/MarginChart.tsx` | 마진율 막대 차트 |

### 6.3 기존 컴포넌트 개선 목록

| 컴포넌트명 | 개선 사항 |
|----------|---------|
| `OperationalSettingsSection` | 경고 UI 추가, 계산 결과 시각화 |
| `FixedCostManagementSection` | 그룹별 배지 추가, 설명 강화 |
| `ProcedureManagementSection` | 시간 구분 설명 추가, 미리보기 개선 |
| `ProcedureResultsSection` | 통계 카드 추가, 차트 추가 |

---

## 7. 각 컴포넌트 상세 명세

### 7.1 ProcedureCatalogSection (시술 카탈로그)

#### 7.1.1 Props

```typescript
// Props 없음 (useStandaloneCosting 사용)
```

#### 7.1.2 State

```typescript
interface ProcedureCatalogSectionState {
  searchQuery: string;
  sortBy: 'name' | 'price' | 'margin' | 'marginRate';
  filterBy: 'all' | 'high' | 'medium' | 'low'; // 마진율 필터
}
```

#### 7.1.3 완전한 구현 코드

```typescript
import React, { useMemo, useState } from 'react';
import { useStandaloneCosting } from '../state/StandaloneCostingProvider';
import ProcedureCard from './ProcedureCard';
import { formatKrw } from '../../../utils/formatters';

const ProcedureCatalogSection: React.FC = () => {
  const { state, upsertProcedure, removeProcedure } = useStandaloneCosting();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'margin' | 'marginRate'>('name');
  const [filterBy, setFilterBy] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  const proceduresWithBreakdowns = useMemo(() => {
    return state.procedures.map(procedure => ({
      procedure,
      breakdown: state.breakdowns.find(b => b.procedureId === procedure.id) || null,
    }));
  }, [state.procedures, state.breakdowns]);

  const filteredProcedures = useMemo(() => {
    let filtered = proceduresWithBreakdowns;

    // 검색 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(({ procedure }) =>
        procedure.name.toLowerCase().includes(query)
      );
    }

    // 마진율 필터
    if (filterBy !== 'all') {
      filtered = filtered.filter(({ breakdown }) => {
        if (!breakdown) return false;
        const rate = breakdown.marginRate;
        if (filterBy === 'high') return rate >= 40;
        if (filterBy === 'medium') return rate >= 30 && rate < 40;
        if (filterBy === 'low') return rate < 30;
        return true;
      });
    }

    // 정렬
    filtered.sort((a, b) => {
      if (sortBy === 'name') {
        return a.procedure.name.localeCompare(b.procedure.name);
      }
      if (sortBy === 'price') {
        return b.procedure.price - a.procedure.price;
      }
      if (sortBy === 'margin') {
        return (b.breakdown?.margin || 0) - (a.breakdown?.margin || 0);
      }
      if (sortBy === 'marginRate') {
        return (b.breakdown?.marginRate || 0) - (a.breakdown?.marginRate || 0);
      }
      return 0;
    });

    return filtered;
  }, [proceduresWithBreakdowns, searchQuery, filterBy, sortBy]);

  const handleEdit = (procedure: ProcedureFormValues) => {
    // 편집 로직 (모달 또는 사이드 패널 열기)
    console.log('Edit:', procedure);
  };

  const handleDuplicate = (procedure: ProcedureFormValues) => {
    const duplicated: ProcedureFormValues = {
      ...procedure,
      id: generateId(),
      name: `${procedure.name} (복사)`,
    };
    upsertProcedure(duplicated);
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">시술 카탈로그</h2>
            <p className="mt-1 text-sm text-gray-600">
              등록된 시술의 원가와 마진을 확인하세요.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {/* 시술 추가 모달 열기 */}}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + 시술 추가
          </button>
        </div>

        {/* 필터 및 정렬 */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {/* 검색 */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="시술명 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* 마진율 필터 */}
          <select
            value={filterBy}
            onChange={(e) => setFilterBy(e.target.value as any)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="all">전체</option>
            <option value="high">마진율 양호 (40% 이상)</option>
            <option value="medium">마진율 보통 (30-40%)</option>
            <option value="low">마진율 주의 (30% 미만)</option>
          </select>

          {/* 정렬 */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="name">이름순</option>
            <option value="price">가격 높은 순</option>
            <option value="margin">마진 큰 순</option>
            <option value="marginRate">마진율 높은 순</option>
          </select>
        </div>
      </header>

      {/* 카드 그리드 */}
      {filteredProcedures.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          {searchQuery || filterBy !== 'all'
            ? '검색 조건에 맞는 시술이 없습니다.'
            : '등록된 시술이 없습니다. 시술을 추가해보세요.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProcedures.map(({ procedure, breakdown }) => (
            <ProcedureCard
              key={procedure.id}
              procedure={procedure}
              breakdown={breakdown}
              onEdit={handleEdit}
              onDuplicate={handleDuplicate}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default ProcedureCatalogSection;
```

### 7.2 ProcedureCard (시술 카드)

#### 7.2.1 Props

```typescript
interface ProcedureCardProps {
  procedure: ProcedureFormValues;
  breakdown: ProcedureCostBreakdown | null;
  onEdit: (procedure: ProcedureFormValues) => void;
  onDuplicate: (procedure: ProcedureFormValues) => void;
}
```

#### 7.2.2 완전한 구현 코드

```typescript
import React from 'react';
import { ProcedureFormValues, ProcedureCostBreakdown } from '../../../services/standaloneCosting/types';
import { formatKrw, formatPercentage } from '../../../utils/formatters';
import MarginBadge from './MarginBadge';

interface ProcedureCardProps {
  procedure: ProcedureFormValues;
  breakdown: ProcedureCostBreakdown | null;
  onEdit: (procedure: ProcedureFormValues) => void;
  onDuplicate: (procedure: ProcedureFormValues) => void;
}

const ProcedureCard: React.FC<ProcedureCardProps> = ({
  procedure,
  breakdown,
  onEdit,
  onDuplicate,
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      {/* 시술명 */}
      <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
        {procedure.name}
      </h3>

      {/* 판매가 */}
      <div className="mt-2">
        <span className="text-2xl font-bold text-gray-900">
          {formatKrw(procedure.price)}
        </span>
      </div>

      {/* 구분선 */}
      <div className="my-4 border-t border-gray-200"></div>

      {breakdown ? (
        <>
          {/* 원가 정보 */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">원가</span>
              <span className="font-medium text-gray-900">
                {formatKrw(breakdown.totalCost)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">마진</span>
              <span className={`font-medium ${breakdown.margin >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                {formatKrw(breakdown.margin)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">마진율</span>
              <div className="flex items-center gap-2">
                <span className={`font-semibold ${
                  breakdown.marginRate >= 40 ? 'text-blue-600' :
                  breakdown.marginRate >= 30 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {formatPercentage(breakdown.marginRate)}
                </span>
                <MarginBadge marginRate={breakdown.marginRate} />
              </div>
            </div>
          </div>

          {/* 시술 시간 */}
          <div className="mt-3 text-xs text-gray-500">
            시술: {procedure.treatmentMinutes}분 / 총 체류: {procedure.totalMinutes}분
          </div>

          {/* 손익분기 */}
          {breakdown.breakevenUnits !== null && (
            <div className="mt-2 rounded-md border border-blue-100 bg-blue-50 p-2 text-xs">
              <span className="text-blue-700">손익분기:</span>{' '}
              <span className="font-medium text-blue-900">
                {Math.ceil(breakdown.breakevenUnits).toLocaleString()}건
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="py-4 text-center text-sm text-gray-400">
          원가 계산 중 오류가 발생했습니다.
        </div>
      )}

      {/* 메모 (있을 경우만 표시) */}
      {procedure.notes && (
        <div className="mt-3 text-xs text-gray-500 line-clamp-2">
          {procedure.notes}
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => onEdit(procedure)}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
        >
          편집
        </button>
        <button
          onClick={() => onDuplicate(procedure)}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
        >
          복사
        </button>
      </div>
    </div>
  );
};

export default ProcedureCard;
```

### 7.3 MarginBadge (마진율 상태 배지)

#### 7.3.1 Props

```typescript
interface MarginBadgeProps {
  marginRate: number;
}
```

#### 7.3.2 완전한 구현 코드

```typescript
import React from 'react';

interface MarginBadgeProps {
  marginRate: number;
}

const MarginBadge: React.FC<MarginBadgeProps> = ({ marginRate }) => {
  const getStatusConfig = (rate: number) => {
    if (rate >= 40) {
      return {
        text: '양호',
        className: 'bg-blue-100 text-blue-800 border-blue-200'
      };
    }
    if (rate >= 30) {
      return {
        text: '개선 필요',
        className: 'bg-yellow-100 text-yellow-800 border-yellow-200'
      };
    }
    return {
      text: '주의',
      className: 'bg-red-100 text-red-800 border-red-200'
    };
  };

  const status = getStatusConfig(marginRate);

  return (
    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded border ${status.className}`}>
      {status.text}
    </span>
  );
};

export default MarginBadge;
```

### 7.4 StatCard (통계 카드)

#### 7.4.1 Props

```typescript
interface StatCardProps {
  title: string;
  value: string;
  description: string;
  variant?: 'default' | 'info' | 'warning';
}
```

#### 7.4.2 완전한 구현 코드

```typescript
import React from 'react';

interface StatCardProps {
  title: string;
  value: string;
  description: string;
  variant?: 'default' | 'info' | 'warning';
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  description,
  variant = 'default',
}) => {
  const variantClasses = {
    default: 'border-gray-200 bg-gray-50',
    info: 'border-blue-200 bg-blue-50',
    warning: 'border-amber-200 bg-amber-50',
  };

  const textClasses = {
    default: 'text-gray-500',
    info: 'text-blue-600',
    warning: 'text-amber-600',
  };

  return (
    <div className={`rounded-md border p-4 text-sm ${variantClasses[variant]}`}>
      <p className={`text-xs font-semibold uppercase tracking-wider ${textClasses[variant]}`}>
        {title}
      </p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{description}</p>
    </div>
  );
};

export default StatCard;
```

### 7.5 Alert (경고/안내 메시지)

#### 7.5.1 Props

```typescript
interface AlertProps {
  variant: 'info' | 'warning' | 'error' | 'success';
  title?: string;
  children: React.ReactNode;
}
```

#### 7.5.2 완전한 구현 코드

```typescript
import React from 'react';

interface AlertProps {
  variant: 'info' | 'warning' | 'error' | 'success';
  title?: string;
  children: React.ReactNode;
}

const Alert: React.FC<AlertProps> = ({ variant, title, children }) => {
  const variantConfig = {
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      icon: (
        <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      ),
    },
    warning: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-800',
      icon: (
        <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      ),
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      icon: (
        <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      ),
    },
    success: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-800',
      icon: (
        <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      ),
    },
  };

  const config = variantConfig[variant];

  return (
    <div className={`rounded-md border p-4 ${config.bg} ${config.border}`}>
      <div className={`flex gap-3 ${config.text}`}>
        {config.icon}
        <div className="flex-1">
          {title && (
            <p className="font-semibold">{title}</p>
          )}
          <div className={title ? 'mt-2' : ''}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Alert;
```

### 7.6 MarginChart (마진율 막대 차트)

#### 7.6.1 Props

```typescript
interface MarginChartProps {
  data: Array<{
    name: string;
    marginRate: number;
  }>;
}
```

#### 7.6.2 완전한 구현 코드

```typescript
import React from 'react';
import { formatPercentage } from '../../../utils/formatters';

interface MarginChartProps {
  data: Array<{
    name: string;
    marginRate: number;
  }>;
}

const MarginChart: React.FC<MarginChartProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="py-8 text-center text-gray-400">
        표시할 데이터가 없습니다.
      </div>
    );
  }

  const maxRate = Math.max(...data.map(d => d.marginRate), 100);

  return (
    <div className="space-y-3">
      {data.map((item, index) => {
        const percentage = (item.marginRate / maxRate) * 100;
        const color =
          item.marginRate >= 40 ? 'bg-blue-600' :
          item.marginRate >= 30 ? 'bg-yellow-600' :
          'bg-red-600';

        return (
          <div key={index} className="flex items-center gap-3">
            {/* 시술명 */}
            <div className="w-24 text-sm font-medium text-gray-700 truncate">
              {item.name}
            </div>

            {/* 막대 */}
            <div className="flex-1 h-6 bg-gray-100 rounded-md overflow-hidden">
              <div
                className={`h-full ${color} transition-all duration-300`}
                style={{ width: `${percentage}%` }}
              />
            </div>

            {/* 마진율 */}
            <div className="w-16 text-sm font-semibold text-gray-900 text-right">
              {formatPercentage(item.marginRate)}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MarginChart;
```

### 7.7 HelpTooltip (도움말 툴팁)

#### 7.7.1 Props

```typescript
interface HelpTooltipProps {
  content: string;
}
```

#### 7.7.2 완전한 구현 코드

```typescript
import React, { useState } from 'react';

interface HelpTooltipProps {
  content: string;
}

const HelpTooltip: React.FC<HelpTooltipProps> = ({ content }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-gray-300 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition"
      >
        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-md border border-gray-200 bg-white p-3 shadow-lg">
          <div className="text-xs text-gray-700">{content}</div>
          {/* 화살표 */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
            <div className="border-8 border-transparent border-t-white" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full border-8 border-transparent border-t-gray-200" />
          </div>
        </div>
      )}
    </div>
  );
};

export default HelpTooltip;
```

---

## 8. 개선된 기존 컴포넌트 명세

### 8.1 OperationalSettingsSection (개선)

**추가 사항**:
1. capacityMinutes === 0일 때 경고 Alert 추가
2. capacityMinutes > 0일 때 계산 결과 시각화

```typescript
// 기존 코드에 추가
{capacityMinutes === 0 && (
  <Alert variant="warning" title="운영 세팅이 설정되지 않았습니다">
    <p>
      월 영업일수와 1일 영업시간을 입력해야 고정비 배분이 계산됩니다.
      현재는 고정비가 시술 원가에 반영되지 않습니다.
    </p>
  </Alert>
)}

{capacityMinutes > 0 && (
  <div className="mt-4 rounded-md border border-blue-100 bg-blue-50 p-4">
    <div className="flex items-center justify-between">
      <p className="text-sm text-blue-800">
        월 가용 시간: <strong>{capacityMinutes.toLocaleString()}분</strong>
      </p>
      <HelpTooltip content="이 값을 기준으로 고정비가 시술별로 배분됩니다." />
    </div>
    <p className="mt-1 text-xs text-blue-700">
      고정비 분당 배분율 = 월 시설·운영비 / {capacityMinutes.toLocaleString()}분
    </p>
  </div>
)}
```

### 8.2 FixedCostManagementSection (개선)

**추가 사항**:
1. 그룹별 배지 추가
2. 그룹별 설명 강화

```typescript
// GROUP_CONFIG에 badge 정보 추가
const GROUP_CONFIG = {
  facility: {
    label: '시설·운영비',
    badge: '자동 배분',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    description: '영업시간에 비례해 시술 원가에 자동 배분되는 항목입니다.',
    help: '월 가용시간으로 나눠 시술별 시간에 비례해 배분됩니다.',
    examples: ['임대료', '관리비', '장비 리스료', '전기·수도'],
  },
  // ... common, marketing 동일 패턴
};

// 렌더링
<div className="flex items-center gap-2">
  <h3 className="text-base font-semibold text-gray-900">
    {GROUP_CONFIG[group].label}
  </h3>
  <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded border ${GROUP_CONFIG[group].badgeColor}`}>
    {GROUP_CONFIG[group].badge}
  </span>
  <HelpTooltip content={GROUP_CONFIG[group].help} />
</div>
```

### 8.3 ProcedureManagementSection (개선)

**추가 사항**:
1. 시술 시간 구분 설명 추가
2. 미리보기 섹션 개선

```typescript
// treatmentMinutes 필드
<label className="flex flex-col gap-1 text-sm text-gray-700">
  <div className="flex items-center justify-between">
    <span>시술 소요시간 (분)</span>
    <HelpTooltip content="실제 시술만 하는 시간입니다. 마진 분석 참고용으로 사용됩니다." />
  </div>
  <input ... />
  <span className="text-xs text-gray-500">
    실제 시술만 하는 시간 (마진 분석 참고용)
  </span>
</label>

// totalMinutes 필드
<label className="flex flex-col gap-1 text-sm text-gray-700">
  <div className="flex items-center justify-between">
    <span>총 체류시간 (분)</span>
    <HelpTooltip content="상담+준비+시술+정리 전체 시간입니다. 고정비 배분은 이 값을 기준으로 계산됩니다." />
  </div>
  <input
    placeholder="비워두면 시술 소요시간과 동일하게 설정됩니다"
    ...
  />
  <span className="text-xs text-gray-500">
    상담+준비+시술+정리 (고정비 배분 기준)
  </span>
</label>
```

### 8.4 ProcedureResultsSection (개선)

**추가 사항**:
1. 통계 카드 사용
2. 마진율 차트 추가

```typescript
// 통계 카드 섹션
<div className="grid gap-3 md:grid-cols-5">
  <StatCard
    title="월 시설·운영비"
    value={formatKrw(facilityTotal)}
    description="시술 시간에 비례해 분배되는 금액입니다."
  />
  <StatCard
    title="월 공통비용"
    value={formatKrw(commonTotal)}
    description="시나리오 탭에서 손익을 검토합니다."
  />
  {/* ... 나머지 통계 카드 */}
</div>

// 마진율 차트 추가
<div className="mt-6">
  <h3 className="text-base font-semibold text-gray-900 mb-3">
    시술별 마진율 비교
  </h3>
  <MarginChart
    data={rows.map(({ procedure, breakdown }) => ({
      name: procedure.name,
      marginRate: breakdown.marginRate,
    }))}
  />
</div>
```

---

(다음 섹션은 4부 문서에서 계속)
