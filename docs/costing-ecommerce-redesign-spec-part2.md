# 시술 원가 계산 모듈 - 구현 명세 2부: UX 흐름 및 화면 설계

> **연결 문서**: `costing-ecommerce-redesign-complete-spec.md` 1부

---

## 4. 전체 UX 흐름

### 4.1 이커머스 방식 UX 개념

**핵심 메타포**:
- **시술 = 상품**: 카탈로그 형태로 진열, 카드 뷰
- **인력/소모품 = 상품 옵션**: 선택 가능한 구성 요소
- **고정비 = 운영 비용**: 배경 설정, 자동 배분
- **마케팅 인사이트 = 매출 최적화 도구**: ROI, ROAS 분석

### 4.2 전체 플로우 (6단계)

```
Step 1: 기초 설정
┌─────────────────────────────────────┐
│ 1. 운영 세팅 (필수) ⭐                │
│  - 월 영업일수                       │
│  - 1일 영업시간                      │
│  → 월 가용시간 자동 계산              │
│                                     │
│ 2. 장비 관리 (준비 중)                │
│  - UI 존재, 비활성화 표시             │
└─────────────────────────────────────┘
            ↓
Step 2: 상품 옵션 설정
┌─────────────────────────────────────┐
│ 3. 인력 등록                         │
│  - 이름, 직무, 월급, 근무시간          │
│  → 분당 단가 자동 계산                │
│                                     │
│ 4. 소모품 등록                       │
│  - 이름, 단가, 수량, 단위             │
│  → 단위당 단가 자동 계산              │
│                                     │
│ 5. 고정비 등록 (3그룹 구분)           │
│  - facility: 시술별 배분 ✅           │
│  - common: 별도 손익 검토 ℹ️          │
│  - marketing: ROI 분석용 📈          │
└─────────────────────────────────────┘
            ↓
Step 3: 상품 등록
┌─────────────────────────────────────┐
│ 6. 시술 등록                         │
│  - 기본 정보 (이름, 가격, 시간)        │
│  - 인력 선택 + 투입 시간              │
│  - 소모품 선택 + 사용량               │
│  → 실시간 원가 미리보기 ✅             │
│  → 자동 저장 및 breakdowns 계산 ✅    │
└─────────────────────────────────────┘
            ↓
Step 4: 결과 확인
┌─────────────────────────────────────┐
│ 7. 시술 카탈로그 (카드 그리드)         │
│  - 시술별 원가, 마진, 마진율           │
│  - 손익분기 건수                     │
│  - 상태 배지 (양호/개선필요/주의)      │
│                                     │
│ 8. 대시보드 (통계)                   │
│  - 평균 마진율                       │
│  - 최소 손익분기 건수                 │
│  - 고정비 3그룹 요약                  │
└─────────────────────────────────────┘
            ↓
Step 5: 인사이트 (향후 확장)
┌─────────────────────────────────────┐
│ 9. 마케팅 인사이트                    │
│  - 시술별 목표 건수 시뮬레이션         │
│  - ROI, ROAS, CAC 계산               │
│  - GPT 분석 리포트                   │
│  - 마케팅비 증감 시나리오              │
└─────────────────────────────────────┘
```

### 4.3 Prerequisite 강화 전략

**현재 문제점**:
- 운영 세팅이 0일 때 조용히 0 반환, 명확한 경고 부족
- 고정비 그룹 구분이 불명확
- treatmentMinutes vs totalMinutes 설명 부족

**개선 방안**:

#### 4.3.1 운영 세팅 0일 때 경고 강화

```tsx
// OperationalSettingsSection 개선
{operationalMinutes === 0 && (
  <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
    <div className="flex items-center gap-2">
      <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      <p className="font-semibold">운영 세팅이 설정되지 않았습니다</p>
    </div>
    <p className="mt-2">
      월 영업일수와 1일 영업시간을 입력해야 고정비 배분이 계산됩니다.
      현재는 고정비가 시술 원가에 반영되지 않습니다.
    </p>
  </div>
)}
```

#### 4.3.2 고정비 그룹 설명 강화

```tsx
// FixedCostManagementSection 개선
const GROUP_INFO = {
  facility: {
    label: '시설·운영비',
    badge: '자동 배분',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    description: '영업시간에 비례해 시술 원가에 자동 배분되는 항목입니다.',
    help: '월 가용시간으로 나눠 시술별 시간에 비례해 배분됩니다.',
    examples: ['임대료', '관리비', '장비 리스료', '전기·수도'],
  },
  common: {
    label: '공통비용',
    badge: '배분 안 함',
    badgeColor: 'bg-gray-100 text-gray-800 border-gray-200',
    description: '시간과 무관하게 발생하며 손익 시나리오에서 커버해야 할 항목입니다.',
    help: '전체 매출 대비로 별도 검토합니다. 시술 원가에는 포함되지 않습니다.',
    examples: ['보험료', '카드 수수료', 'CRM 사용료', '회계·노무 비용'],
  },
  marketing: {
    label: '마케팅 비용',
    badge: 'ROI 분석용',
    badgeColor: 'bg-green-100 text-green-800 border-green-200',
    description: '시나리오/인사이트 탭에서 조정되는 마케팅 지출입니다.',
    help: '마케팅 인사이트에서 증감 시뮬레이션합니다. 시술 원가에는 포함되지 않습니다.',
    examples: ['디지털 광고', '오프라인 광고', '프로모션 이벤트'],
  },
};

// 렌더링
<div className="flex items-center gap-2">
  <h3 className="text-base font-semibold text-gray-900">{GROUP_INFO[group].label}</h3>
  <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded border ${GROUP_INFO[group].badgeColor}`}>
    {GROUP_INFO[group].badge}
  </span>
</div>
<p className="mt-1 text-sm text-gray-600">{GROUP_INFO[group].description}</p>
<div className="mt-1 text-xs text-gray-500">
  <strong>계산 방식:</strong> {GROUP_INFO[group].help}
</div>
```

#### 4.3.3 시술 시간 구분 명확화

```tsx
// ProcedureManagementSection 개선
<label className="flex flex-col gap-1 text-sm text-gray-700">
  <div className="flex items-center justify-between">
    <span>시술 소요시간 (분)</span>
    <button type="button" className="text-xs text-blue-600 hover:underline">
      설명 보기
    </button>
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
    <button type="button" className="text-xs text-blue-600 hover:underline">
      설명 보기
    </button>
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
    상담+준비+시술+정리 전체 시간 (고정비 배분 기준) ⭐
  </span>
</label>
```

---

## 5. 화면별 상세 설계

### 5.1 운영 세팅 화면 (Operational Settings)

**현재 구현**: `OperationalSettingsSection.tsx`
**변경 사항**: 경고 UI 강화, 계산 결과 시각화

#### 5.1.1 레이아웃

```
┌────────────────────────────────────────────────────────────┐
│ 운영 세팅                            최근 저장: 2025-10-03 │
│ 영업일과 영업시간을 입력해 월 가용 시간을 정의합니다.         │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ ┌─────────────────┐  ┌─────────────────┐                 │
│ │ 월 영업일수       │  │ 1일 영업시간     │                 │
│ │ [26        ]    │  │ [10        ] 시간│                 │
│ └─────────────────┘  └─────────────────┘                 │
│                                                            │
│ ┌──────────────────────────────────────────────────────┐  │
│ │ 메모                                                  │  │
│ │ [                                                    ]│  │
│ └──────────────────────────────────────────────────────┘  │
│                                                            │
│ 월 가용 시간: 15,600분              [저장]                  │
│                                                            │
├────────────────────────────────────────────────────────────┤
│ ⚠️ 운영 세팅이 설정되지 않았습니다                           │
│ 월 영업일수와 1일 영업시간을 입력해야 고정비 배분이           │
│ 계산됩니다. 현재는 고정비가 시술 원가에 반영되지 않습니다.    │
└────────────────────────────────────────────────────────────┘
```

#### 5.1.2 컴포넌트 구조

```typescript
const OperationalSettingsSection: React.FC = () => {
  const { state, setOperationalConfig } = useStandaloneCosting();
  const [form, setForm] = useState<FormState>(...);
  const capacityMinutes = useMemo(() => calculateOperationalMinutes(state.operational), [...]);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <header>...</header>
      <form>...</form>

      {/* 경고 UI (capacityMinutes === 0일 때만 표시) */}
      {capacityMinutes === 0 && (
        <Alert variant="warning">
          운영 세팅이 설정되지 않았습니다...
        </Alert>
      )}

      {/* 계산 결과 표시 (capacityMinutes > 0일 때) */}
      {capacityMinutes > 0 && (
        <div className="mt-4 rounded-md border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm text-blue-800">
            월 가용 시간: <strong>{capacityMinutes.toLocaleString()}분</strong>
          </p>
          <p className="mt-1 text-xs text-blue-700">
            이 값을 기준으로 고정비가 시술별로 배분됩니다.
          </p>
        </div>
      )}
    </section>
  );
};
```

### 5.2 고정비 관리 화면 (Fixed Cost Management)

**현재 구현**: `FixedCostManagementSection.tsx`
**변경 사항**: 그룹별 설명 강화, 배지 추가

#### 5.2.1 레이아웃

```
┌────────────────────────────────────────────────────────────┐
│ 인건비 제외 고정비 입력                 전체 합계: 10,000,000원│
│ 시설·운영비는 시술 시간에 따라 배분되고, 공통비용과           │
│ 마케팅 비용은 시나리오 탭에서 손익을 검증합니다.              │
├────────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│ │시설·운영비    │ │공통비용       │ │마케팅 비용     │        │
│ │5,000,000원   │ │2,000,000원   │ │3,000,000원    │        │
│ └──────────────┘ └──────────────┘ └──────────────┘        │
├────────────────────────────────────────────────────────────┤
│ ℹ️ 현재 입력 대상                                           │
│ 시설·운영비: 영업시간에 비례해 시술 원가에 배분되는 항목입니다.│
│ 예시 항목: 임대료, 관리비, 장비 리스료, 전기·수도             │
├────────────────────────────────────────────────────────────┤
│ [시설·운영비] [공통비용] [마케팅 비용]                        │
│              (탭 버튼)                                      │
├────────────────────────────────────────────────────────────┤
│ 고정비 이름      월 금액 (원)    메모                         │
│ [          ]    [          ]    [                    ]     │
│                                              [고정비 추가]   │
├────────────────────────────────────────────────────────────┤
│ 시설·운영비 [자동 배분]              월 합계: 5,000,000원     │
│ 영업시간에 비례해 시술 원가에 배분되는 항목입니다.             │
│ 예시: 임대료, 관리비, 장비 리스료, 전기·수도                  │
│                                                            │
│ ┌────────────────────────────────────────────────────┐    │
│ │ 이름       월 금액        메모              [편집][삭제] │    │
│ │ 임대료     2,000,000원   강남점                         │    │
│ │ 관리비     500,000원     -                             │    │
│ │ 전기·수도   300,000원     -                             │    │
│ └────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────┘
```

#### 5.2.2 그룹별 배지 컴포넌트

```typescript
const GroupBadge: React.FC<{ group: FixedCostGroup }> = ({ group }) => {
  const config = {
    facility: {
      label: '자동 배분',
      className: 'bg-blue-100 text-blue-800 border-blue-200',
    },
    common: {
      label: '배분 안 함',
      className: 'bg-gray-100 text-gray-800 border-gray-200',
    },
    marketing: {
      label: 'ROI 분석용',
      className: 'bg-green-100 text-green-800 border-green-200',
    },
  };

  const { label, className } = config[group];

  return (
    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded border ${className}`}>
      {label}
    </span>
  );
};
```

### 5.3 시술 관리 화면 (Procedure Management) - 이커머스 스타일

**현재 구현**: `ProcedureManagementSection.tsx` (폼 중심)
**개편 방향**: 카드 그리드 추가, 폼은 모달 또는 사이드 패널로 이동

#### 5.3.1 카드 그리드 레이아웃

```
┌────────────────────────────────────────────────────────────┐
│ 시술 카탈로그                               [+ 시술 추가]    │
│ 등록된 시술의 원가와 마진을 확인하세요.                       │
├────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│ │울쎄라     │ │보톡스     │ │필러       │                    │
│ │리프팅     │ │이마       │ │코         │                    │
│ │          │ │          │ │          │                    │
│ │1,200,000원│ │350,000원  │ │800,000원  │                    │
│ │          │ │          │ │          │                    │
│ │원가: 82k │ │원가: 45k  │ │원가: 120k │                    │
│ │마진: 1.1M│ │마진: 305k │ │마진: 680k │                    │
│ │마진율: 93%│ │마진율: 87%│ │마진율: 85%│                    │
│ │[양호]     │ │[양호]     │ │[양호]     │                    │
│ │          │ │          │ │          │                    │
│ │시술: 30분 │ │시술: 10분 │ │시술: 20분 │                    │
│ │          │ │          │ │          │                    │
│ │[편집][복사]│ │[편집][복사]│ │[편집][복사]│                    │
│ └──────────┘ └──────────┘ └──────────┘                    │
│                                                            │
│ ┌──────────┐ ┌──────────┐                                 │
│ │슈링크     │ │레이저     │                                 │
│ │리프팅     │ │토닝       │                                 │
│ │...       │ │...       │                                 │
│ └──────────┘ └──────────┘                                 │
└────────────────────────────────────────────────────────────┘
```

#### 5.3.2 시술 카드 컴포넌트

```typescript
interface ProcedureCardProps {
  procedure: ProcedureFormValues;
  breakdown: ProcedureCostBreakdown;
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
      <h3 className="text-lg font-semibold text-gray-900">
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
          <span className="font-medium text-gray-900">
            {formatKrw(breakdown.margin)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">마진율</span>
          <div className="flex items-center gap-2">
            <span className={`font-semibold ${
              breakdown.marginRate > 40 ? 'text-blue-600' :
              breakdown.marginRate > 30 ? 'text-yellow-600' :
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
        시술시간: {procedure.treatmentMinutes}분 / 총 체류: {procedure.totalMinutes}분
      </div>

      {/* 손익분기 */}
      {breakdown.breakevenUnits !== null && (
        <div className="mt-2 text-xs text-gray-600">
          손익분기: <span className="font-medium">{Math.ceil(breakdown.breakevenUnits).toLocaleString()}건</span>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => onEdit(procedure)}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          편집
        </button>
        <button
          onClick={() => onDuplicate(procedure)}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          복사
        </button>
      </div>
    </div>
  );
};
```

#### 5.3.3 마진율 상태 배지

```typescript
const MarginBadge: React.FC<{ marginRate: number }> = ({ marginRate }) => {
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
```

### 5.4 결과 대시보드 (Results Dashboard)

**현재 구현**: `ProcedureResultsSection.tsx` (테이블 중심)
**개편 방향**: 통계 카드 + 차트 추가

#### 5.4.1 레이아웃

```
┌────────────────────────────────────────────────────────────┐
│ 운영 대시보드                                               │
│ 전체 시술 원가 분석 및 핵심 지표를 확인하세요.                 │
├────────────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐         │
│ │시설·운영비│ │공통비용  │ │마케팅비용│ │평균 마진율│         │
│ │5,000,000 │ │2,000,000│ │3,000,000│ │89.5%    │         │
│ │원        │ │원       │ │원       │ │         │         │
│ │배분됨    │ │별도 검토 │ │ROI 분석 │ │         │         │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘         │
│                                                            │
│ ┌─────────┐                                               │
│ │최소 손익  │                                               │
│ │분기 건수  │                                               │
│ │5건      │                                               │
│ └─────────┘                                               │
├────────────────────────────────────────────────────────────┤
│ 시술별 마진율 비교 (차트)                                    │
│ ┌──────────────────────────────────────────────────────┐  │
│ │                                                       │  │
│ │ 울쎄라  ████████████████████ 93.1%                    │  │
│ │ 보톡스  ██████████████████ 87.1%                      │  │
│ │ 필러    █████████████████ 85.0%                       │  │
│ │ 슈링크  ███████████████ 75.0%                         │  │
│ │                                                       │  │
│ └──────────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────────┤
│ 시술별 상세 데이터 (테이블)                                  │
│ ┌────────────────────────────────────────────────────┐    │
│ │ 시술명 | 판매가 | 원가 | 마진 | 마진율 | 손익분기 │    │
│ │ 울쎄라 | 1.2M  | 82k | 1.1M | 93.1% | 5건      │    │
│ │ ...                                              │    │
│ └────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────┘
```

#### 5.4.2 통계 카드 컴포넌트

```typescript
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

  return (
    <div className={`rounded-md border p-4 text-sm ${variantClasses[variant]}`}>
      <p className="text-xs font-semibold text-gray-500">{title}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{description}</p>
    </div>
  );
};
```

### 5.5 마케팅 인사이트 (Marketing Insights)

**현재 구현**: `MarketingInsightsSection.tsx` (준비 중 상태)
**향후 확장**: 시뮬레이션 + GPT 분석

#### 5.5.1 향후 확장 방향

```
┌────────────────────────────────────────────────────────────┐
│ 마케팅 인사이트                                              │
│ 마케팅 비용 대비 수익성을 시뮬레이션하고 GPT 분석을 받아보세요.│
├────────────────────────────────────────────────────────────┤
│ 1. 시술별 목표 건수 설정                                     │
│ ┌────────────────────────────────────────────────────┐    │
│ │ 시술명     | 목표 건수 | 예상 매출 | 필요 마케팅비 │    │
│ │ 울쎄라     | [10   ]건| 12,000,000| 2,400,000원   │    │
│ │ 보톡스     | [30   ]건| 10,500,000| 2,100,000원   │    │
│ │ ...                                              │    │
│ └────────────────────────────────────────────────────┘    │
├────────────────────────────────────────────────────────────┤
│ 2. 마케팅 ROI 계산                                          │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐                      │
│ │총 마케팅비│ │예상 매출 │ │ROI      │                      │
│ │4,500,000│ │22,500,000│ │400%     │                      │
│ │원       │ │원        │ │         │                      │
│ └─────────┘ └─────────┘ └─────────┘                      │
│                                                            │
│ ┌─────────┐ ┌─────────┐                                   │
│ │ROAS     │ │평균 CAC  │                                   │
│ │500%     │ │112,500원 │                                   │
│ └─────────┘ └─────────┘                                   │
├────────────────────────────────────────────────────────────┤
│ 3. GPT 분석 리포트 (준비 중)                                │
│ ┌────────────────────────────────────────────────────┐    │
│ │ [분석 요청] 버튼                                     │    │
│ │                                                    │    │
│ │ GPT가 분석한 매출 극대화 전략이 여기에 표시됩니다.    │    │
│ │ - 장비 증설 추천                                    │    │
│ │ - 인력 충원 제안                                    │    │
│ │ - 시술 가격 조정 제안                               │    │
│ └────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────┘
```

---

(다음 섹션은 3부 문서에서 계속)
