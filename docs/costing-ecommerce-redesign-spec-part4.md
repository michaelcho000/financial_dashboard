# 시술 원가 계산 모듈 - 구현 명세 4부: 구현 가이드

> **연결 문서**: `costing-ecommerce-redesign-complete-spec.md` 1부, `costing-ecommerce-redesign-spec-part2.md` 2부, `costing-ecommerce-redesign-spec-part3.md` 3부

---

## 9. 디자인 시스템 준수 사항

### 9.1 색상 팔레트

**사용 가능한 색상** (index.css 및 기존 컴포넌트 분석 결과):

| 용도 | Tailwind 클래스 | 사용 예시 |
|-----|----------------|----------|
| Primary | `blue-600`, `blue-700`, `blue-50`, `blue-100` | 버튼, 활성 탭, 강조 |
| Gray 계열 | `gray-50~900` | 배경, 텍스트, 테두리 |
| Slate 계열 | `slate-50~800` | 헤더, 대시보드 텍스트 |
| 경고 | `amber-50`, `amber-200`, `amber-600`, `yellow-600~700` | 경고 메시지, 개선 필요 상태 |
| 에러 | `red-50`, `red-200`, `red-600` | 오류 메시지, 주의 상태 |
| 성공 | `green-50`, `green-200`, `green-600~800` | 성공 메시지, 양호 상태 |

**금지 사항**:
- ❌ Emoji 사용 금지
- ❌ 완전히 새로운 색상 추가 금지
- ❌ 인라인 스타일 금지 (Tailwind utility classes만 사용)

### 9.2 Typography

**폰트 패밀리** (index.css:11):
```css
font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, Roboto, 'Helvetica Neue', 'Segoe UI', sans-serif;
```

**텍스트 크기 및 스타일**:

| 요소 | Tailwind 클래스 | 예시 |
|-----|----------------|------|
| 페이지 제목 | `text-2xl font-bold text-gray-900` | "시술 원가 계산" |
| 섹션 제목 | `text-lg font-semibold text-gray-900` | "운영 세팅" |
| 서브 제목 | `text-base font-semibold text-gray-900` | "시설·운영비" |
| 본문 | `text-sm text-gray-600` | 설명 텍스트 |
| 라벨 | `text-sm text-gray-700` | 폼 라벨 |
| 캡션 | `text-xs text-gray-500` | 도움말, 메모 |
| 강조 | `font-semibold text-gray-900` | 숫자, 금액 |

### 9.3 간격 및 레이아웃

**공통 패턴**:

| 요소 | Tailwind 클래스 |
|-----|----------------|
| 섹션 패딩 | `p-6` |
| 섹션 간격 | `space-y-6` |
| 요소 간격 | `gap-2`, `gap-3`, `gap-4` |
| 그리드 간격 | `gap-4`, `gap-6` |

**카드 스타일**:
```tsx
<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
  ...
</div>
```

**버튼 스타일**:

Primary 버튼:
```tsx
<button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
  저장
</button>
```

Secondary 버튼:
```tsx
<button className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
  취소
</button>
```

**Input 스타일**:
```tsx
<input className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
```

### 9.4 반응형 디자인

**그리드 레이아웃**:
```tsx
// 1열 → 2열 → 3열
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  ...
</div>

// 2열 → 3열 → 5열
<div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
  ...
</div>
```

**플렉스 레이아웃**:
```tsx
// 세로 → 가로
<div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
  ...
</div>
```

---

## 10. 상태 관리 및 데이터 흐름

### 10.1 StandaloneCostingProvider 사용법

**Context 구조**:
```typescript
interface StandaloneCostingContextValue {
  state: StandaloneCostingState;
  setOperationalConfig: (payload: OperationalConfig) => void;
  setEquipmentHierarchyEnabled: (enabled: boolean) => void;
  upsertEquipment: (payload: EquipmentProfile) => void;
  removeEquipment: (id: string) => void;
  upsertStaff: (payload: StaffProfile) => void;
  removeStaff: (id: string) => void;
  upsertMaterial: (payload: MaterialItem) => void;
  removeMaterial: (id: string) => void;
  upsertFixedCost: (payload: FixedCostItem) => void;
  removeFixedCost: (id: string) => void;
  upsertProcedure: (payload: ProcedureFormValues) => void;
  removeProcedure: (id: string) => void;
  resetAll: () => void;
  hydrated: boolean;
}
```

**사용 예시**:
```typescript
const MyComponent: React.FC = () => {
  const { state, upsertProcedure } = useStandaloneCosting();

  const handleSave = (procedure: ProcedureFormValues) => {
    upsertProcedure(procedure);
    // 자동으로 breakdowns 재계산됨
    // 자동으로 API에 저장됨
  };

  return (
    <div>
      {state.procedures.map(p => <div key={p.id}>{p.name}</div>)}
    </div>
  );
};
```

### 10.2 자동 계산 흐름

**트리거 → 계산 → 저장 순서**:

```
1. 사용자 액션 (예: upsertProcedure)
   ↓
2. Reducer: UPSERT_PROCEDURE 액션 디스패치
   ↓
3. recalcBreakdowns() 호출
   ├─ normalizeFixedCosts()
   └─ buildAllBreakdowns()
       └─ buildProcedureBreakdown() (calculations.ts)
           ├─ calculateDirectLaborCost()
           ├─ calculateMaterialCost()
           ├─ calculateFixedCostPerMinute()
           └─ calculateBreakevenUnits()
   ↓
4. state 업데이트
   ↓
5. useEffect → saveDraft()
   ↓
6. POST /api/standalone-costing
```

### 10.3 로컬 상태 관리 패턴

**폼 상태**:
```typescript
// 예시: ProcedureManagementSection
const [form, setForm] = useState<ProcedureFormState>(emptyProcedureForm);

const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  const { name, value } = event.target;
  setForm(prev => ({ ...prev, [name]: value }));
};

const handleSubmit = (event: React.FormEvent) => {
  event.preventDefault();
  const payload = transformFormToPayload(form);
  upsertProcedure(payload); // Provider 메서드 호출
  resetForm();
};
```

**실시간 미리보기**:
```typescript
const previewProcedure: ProcedureFormValues = useMemo(() => {
  return {
    id: form.id ?? 'preview',
    name: form.name.trim() || '미리보기',
    price: parseNumber(form.price) ?? 0,
    treatmentMinutes: parseNumber(form.treatmentMinutes) ?? 0,
    totalMinutes: parseNumber(form.totalMinutes) ?? treatmentMinutes,
    staffAssignments: toAssignments(staffAssignments),
    materialUsages: toMaterialUsages(materialUsages),
  };
}, [form, staffAssignments, materialUsages]);

const previewBreakdown = useMemo(() => {
  return buildProcedureBreakdown(previewProcedure, {
    staff: state.staff,
    materials: state.materials,
    fixedCosts: state.fixedCosts,
    operational: state.operational,
  });
}, [previewProcedure, state]);
```

---

## 11. 에러 처리 및 검증

### 11.1 입력 검증

**숫자 입력 검증**:
```typescript
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
```

**필수 필드 검증**:
```typescript
// HTML5 required 속성 사용
<input
  name="name"
  value={form.name}
  onChange={handleChange}
  required
  className="..."
/>

// 또는 제출 시 검증
const handleSubmit = (event: React.FormEvent) => {
  event.preventDefault();

  if (!form.name.trim()) {
    alert('시술명을 입력하세요.');
    return;
  }

  if (parseNumber(form.price) === null || parseNumber(form.price) <= 0) {
    alert('판매가를 입력하세요.');
    return;
  }

  // ... 제출 로직
};
```

### 11.2 계산 오류 처리

**0으로 나누기 방지**:
```typescript
// calculations.ts:74-80
const calculateFixedCostPerMinute = (fixedCosts, operationalMinutes) => {
  if (!operationalMinutes) {
    return 0; // 0으로 나누기 방지
  }
  const facilityFixed = calculateMonthlyFixedTotal(fixedCosts, 'facility');
  return facilityFixed / operationalMinutes;
};
```

**breakdown 계산 실패 처리**:
```typescript
const previewBreakdown = useMemo(() => {
  try {
    return buildProcedureBreakdown(previewProcedure, context);
  } catch (error) {
    console.error('[StandaloneCosting] Failed to build preview breakdown', error);
    return null;
  }
}, [previewProcedure, context]);

// 렌더링
{previewBreakdown ? (
  <div>... 정상 표시 ...</div>
) : (
  <div className="text-sm text-red-600">
    원가 계산 중 오류가 발생했습니다.
  </div>
)}
```

### 11.3 사용자 경고

**prerequisite 미충족 시**:
```typescript
const handleTabSelect = (nextTabId: string) => {
  const nextIndex = tabs.findIndex(tab => tab.id === nextTabId);

  if (nextIndex > 0) {
    for (let i = 0; i < nextIndex; i += 1) {
      const prerequisite = tabs[i];
      if (prerequisite.completion && !prerequisite.completion()) {
        // NotificationModal 표시
        setModalMessage(prerequisite.incompleteMessage ?? '이전 단계를 먼저 완료하세요.');
        // 해당 prerequisite 탭으로 이동
        setActiveTab(prerequisite.id);
        return;
      }
    }
  }

  setActiveTab(nextTabId);
};
```

**삭제 확인**:
```typescript
const handleDelete = (item: FixedCostItem) => {
  const confirmed = window.confirm(`${item.name} 고정비를 삭제하시겠습니까?`);
  if (confirmed) {
    removeFixedCost(item.id);
  }
};
```

**소모품 미등록 경고**:
```typescript
const handleSubmit = (event: React.FormEvent) => {
  event.preventDefault();

  const payload = transformFormToPayload(form);

  if (payload.materialUsages.length === 0) {
    setPendingProcedure(payload);
    setWarnNoMaterial(true); // ConfirmationModal 표시
    return;
  }

  finalizeSave(payload);
};

// ConfirmationModal
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
```

---

## 12. 구현 순서 및 체크리스트

### 12.1 Phase 1: 기반 컴포넌트 (1-2일)

**목표**: 공통 UI 컴포넌트 구축

- [ ] `Alert` 컴포넌트 작성 (`components/Alert.tsx`)
- [ ] `StatCard` 컴포넌트 작성 (`components/StatCard.tsx`)
- [ ] `MarginBadge` 컴포넌트 작성 (`components/MarginBadge.tsx`)
- [ ] `HelpTooltip` 컴포넌트 작성 (`components/HelpTooltip.tsx`)
- [ ] `MarginChart` 컴포넌트 작성 (`components/MarginChart.tsx`)

**검증**:
- Storybook 또는 독립 페이지에서 각 컴포넌트 렌더링 확인
- 모든 variant/props 조합 테스트
- 반응형 동작 확인

### 12.2 Phase 2: 기존 컴포넌트 개선 (2-3일)

**목표**: 경고 강화, 설명 추가

- [ ] `OperationalSettingsSection` 개선
  - [ ] `capacityMinutes === 0` 일 때 경고 Alert 추가
  - [ ] `capacityMinutes > 0` 일 때 계산 결과 시각화
  - [ ] HelpTooltip 추가
- [ ] `FixedCostManagementSection` 개선
  - [ ] GROUP_CONFIG에 badge, help 정보 추가
  - [ ] 각 그룹 제목에 배지 추가
  - [ ] HelpTooltip 추가
- [ ] `ProcedureManagementSection` 개선
  - [ ] treatmentMinutes, totalMinutes 필드에 설명 추가
  - [ ] HelpTooltip 추가
  - [ ] 미리보기 섹션 개선

**검증**:
- 각 섹션에서 경고가 올바르게 표시되는지 확인
- HelpTooltip이 올바른 내용을 보여주는지 확인
- 기존 기능이 정상 작동하는지 회귀 테스트

### 12.3 Phase 3: 시술 카탈로그 (3-4일)

**목표**: 이커머스 스타일 카드 그리드

- [ ] `ProcedureCard` 컴포넌트 작성 (`components/ProcedureCard.tsx`)
  - [ ] Props 정의
  - [ ] 레이아웃 구현
  - [ ] MarginBadge 통합
  - [ ] 편집/복사 버튼 연결
- [ ] `ProcedureCatalogSection` 컴포넌트 작성 (`components/ProcedureCatalogSection.tsx`)
  - [ ] 검색 기능
  - [ ] 마진율 필터
  - [ ] 정렬 기능
  - [ ] 카드 그리드 레이아웃
  - [ ] "시술 추가" 버튼
- [ ] `StandaloneCostingPage`에 탭 추가
  - [ ] "시술 카탈로그" 탭 추가 (시술·결과 탭 대체 또는 분리)

**검증**:
- 카드가 올바르게 렌더링되는지 확인
- 검색/필터/정렬이 정상 작동하는지 확인
- 편집/복사 버튼이 올바르게 동작하는지 확인
- 반응형 그리드 동작 확인

### 12.4 Phase 4: 결과 대시보드 개선 (2-3일)

**목표**: 통계 카드 + 차트 추가

- [ ] `ProcedureResultsSection` 개선
  - [ ] 기존 통계를 StatCard로 교체
  - [ ] MarginChart 추가
  - [ ] 레이아웃 개선

**검증**:
- 통계 카드가 올바른 값을 표시하는지 확인
- 차트가 올바르게 렌더링되는지 확인
- 테이블과 차트가 동일한 데이터를 보여주는지 확인

### 12.5 Phase 5: 통합 테스트 및 버그 수정 (1-2일)

**목표**: 전체 플로우 검증

- [ ] 전체 플로우 테스트
  - [ ] 운영 세팅 → 인력 → 소모품 → 고정비 → 시술 등록 → 결과 확인
  - [ ] Prerequisite 체크 동작 확인
  - [ ] 각 단계에서 데이터 입력 후 다음 단계 이동
- [ ] 계산 정합성 검증
  - [ ] 샘플 데이터로 손 계산과 비교
  - [ ] Breakdowns가 올바르게 계산되는지 확인
  - [ ] 마진율, 손익분기 검증
- [ ] 에러 케이스 테스트
  - [ ] 0으로 나누기 시도
  - [ ] 필수 필드 미입력
  - [ ] 비정상 값 입력
- [ ] 반응형 테스트
  - [ ] 모바일, 태블릿, 데스크톱 화면에서 확인
- [ ] 브라우저 호환성 테스트
  - [ ] Chrome, Firefox, Safari, Edge

**검증 체크리스트**:
- [ ] 모든 계산이 정확함
- [ ] UI가 디자인 시스템을 준수함
- [ ] Emoji가 사용되지 않음
- [ ] 모든 경고가 올바르게 표시됨
- [ ] Prerequisite 체크가 정상 작동함
- [ ] 자동 저장이 정상 작동함

### 12.6 Phase 6: 문서화 및 코드 리뷰 (1일)

- [ ] 컴포넌트별 JSDoc 주석 작성
- [ ] README 또는 개발 가이드 작성
- [ ] 코드 리뷰 진행
- [ ] 최종 버그 수정

---

## 13. 계산 정합성 검증 시나리오

### 13.1 기본 시나리오

**입력 데이터**:
```
운영 세팅:
- 월 영업일수: 26일
- 1일 영업시간: 10시간
→ 월 가용시간: 15,600분

인력:
- 의사: 8,000,000원 / (22일 × 8시간)
  → 757.58원/분
- 간호사: 3,500,000원 / (22일 × 8시간)
  → 330.69원/분

소모품:
- 울쎄라 팁: 204,000원 / 2,400 shots
  → 85원/shot
- 마취 크림: 15,000원 / 1개

고정비:
- 시설·운영비(facility): 5,000,000원
- 공통비용(common): 2,000,000원
- 마케팅 비용(marketing): 3,000,000원

시술:
- 이름: 울쎄라 리프팅
- 판매가: 1,200,000원
- 시술 시간: 30분
- 총 체류시간: 45분
- 투입 인력:
  - 의사 30분
  - 간호사 15분
- 소모품:
  - 울쎄라 팁 300 shots
  - 마취 크림 1개
```

**예상 결과**:
```
직접 인건비:
  757.58 × 30 + 330.69 × 15 = 22,727 + 4,960 = 27,687원

소모품 비용:
  85 × 300 + 15,000 = 25,500 + 15,000 = 40,500원

고정비 분당:
  5,000,000 / 15,600 = 320.51원/분

고정비 배분:
  320.51 × 45 = 14,423원

총 원가:
  27,687 + 40,500 + 14,423 = 82,610원

마진:
  1,200,000 - 82,610 = 1,117,390원

마진율:
  (1,117,390 / 1,200,000) × 100 = 93.12%

직접비용:
  27,687 + 40,500 = 68,187원

기여이익:
  1,200,000 - 68,187 = 1,131,813원

손익분기:
  5,000,000 / 1,131,813 = 4.4건 → 올림 5건
```

**검증 방법**:
1. 위 데이터를 시스템에 입력
2. 계산 결과를 확인
3. 각 항목이 예상 결과와 일치하는지 확인 (±1원 허용, 반올림 오차)

### 13.2 엣지 케이스

**케이스 1: 운영 세팅 0**
```
- 월 영업일수: 0 또는 null
- 1일 영업시간: 10

예상 결과:
- 월 가용시간: 0분
- 고정비 분당: 0원/분
- 고정비 배분: 0원
- 경고 Alert 표시
```

**케이스 2: 소모품 없는 시술**
```
- 소모품 사용: 0개

예상 결과:
- 소모품 비용: 0원
- ConfirmationModal 표시 (계속 저장 확인)
```

**케이스 3: 마진 음수**
```
- 판매가: 50,000원
- 총 원가: 82,610원

예상 결과:
- 마진: -32,610원 (빨간색 표시)
- 마진율: -65.22% (빨간색 표시)
- 손익분기: null (기여이익 부족)
```

**케이스 4: 고정비 0**
```
- 시설·운영비(facility): 0원

예상 결과:
- 고정비 분당: 0원/분
- 고정비 배분: 0원
- 손익분기: 0건 (또는 계산 불가)
```

---

## 14. 최종 체크리스트

### 14.1 기능 요구사항

- [ ] 운영 세팅 입력 및 월 가용시간 계산
- [ ] 인력 등록 및 분당 단가 계산
- [ ] 소모품 등록 및 단위 단가 계산
- [ ] 고정비 3그룹(facility/common/marketing) 등록
- [ ] 시술 등록 및 실시간 원가 미리보기
- [ ] 시술 카탈로그 (카드 그리드)
- [ ] 검색, 필터, 정렬 기능
- [ ] 결과 대시보드 (통계 카드 + 차트)
- [ ] Prerequisite 체크 및 탭 이동 제한
- [ ] 자동 저장 (API 연동)

### 14.2 계산 정합성

- [ ] 월 가용시간 = 월 영업일수 × 1일 영업시간 × 60
- [ ] 인력 분당 단가 = 월급 / (근무일수 × 근무시간 × 60)
- [ ] 소모품 단위 단가 = 단가 / 수량
- [ ] 고정비 분당 = 월 시설·운영비 / 월 가용시간
- [ ] 직접 인건비 = Σ(인력 분당 단가 × 투입 시간)
- [ ] 소모품 비용 = Σ(소모품 단위 단가 × 사용량)
- [ ] 고정비 배분 = 고정비 분당 × 총 체류시간 (totalMinutes)
- [ ] 총 원가 = 직접 인건비 + 소모품 비용 + 고정비 배분
- [ ] 마진 = 판매가 - 총 원가
- [ ] 마진율 = (마진 / 판매가) × 100
- [ ] 손익분기 = 월 시설비 / 기여이익

### 14.3 UX 요구사항

- [ ] 운영 세팅 0일 때 명확한 경고
- [ ] 고정비 그룹별 배지 및 설명
- [ ] 시술 시간 구분 (treatmentMinutes vs totalMinutes) 설명
- [ ] 이커머스 스타일 카드 그리드
- [ ] 마진율 상태 배지 (양호/개선필요/주의)
- [ ] 실시간 미리보기
- [ ] Prerequisite 체크 모달

### 14.4 디자인 시스템 준수

- [ ] Emoji 미사용
- [ ] 기존 Tailwind 색상 팔레트 준수
- [ ] Pretendard 폰트 사용
- [ ] 카드 스타일: `bg-white rounded-lg shadow-sm border border-gray-200`
- [ ] 버튼 스타일: Primary/Secondary 패턴 준수
- [ ] Input 스타일: 기존 패턴 준수
- [ ] 반응형 그리드 구현

### 14.5 에러 처리

- [ ] 0으로 나누기 방지
- [ ] 필수 필드 검증
- [ ] 숫자 입력 검증
- [ ] 계산 오류 catch 및 표시
- [ ] 삭제 확인 모달
- [ ] Prerequisite 미충족 시 경고

### 14.6 테스트

- [ ] 기본 시나리오 검증
- [ ] 엣지 케이스 검증
- [ ] 반응형 테스트
- [ ] 브라우저 호환성 테스트
- [ ] 회귀 테스트 (기존 기능 정상 작동)

---

## 15. 마무리

### 15.1 개편 전후 비교

| 항목 | 개편 전 | 개편 후 |
|-----|--------|--------|
| 시술 UI | 폼 중심 테이블 | 이커머스 카드 그리드 |
| 고정비 설명 | 불명확 | 그룹별 배지 + 툴팁 |
| 운영 세팅 경고 | 약함 | Alert 컴포넌트로 강화 |
| 시술 시간 설명 | 부족 | HelpTooltip으로 명확화 |
| 통계 표시 | 테이블만 | StatCard + 차트 |
| 마진율 상태 | 숫자만 | 배지 + 색상 구분 |
| 실시간 피드백 | 미리보기만 | 미리보기 + 카드 + 차트 |

### 15.2 성공 지표

- ✅ 계산 정합성 100% 유지
- ✅ 기존 디자인 시스템 100% 준수
- ✅ Emoji 0개 사용
- ✅ Prerequisite 체크 강화
- ✅ 사용자 피드백 개선 (경고, 설명, 툴팁)
- ✅ 이커머스 스타일 UX 구현

### 15.3 향후 확장

**마케팅 인사이트 (Phase 7)**:
- 시술별 목표 건수 설정
- ROI, ROAS, CAC 계산
- GPT 분석 리포트
- 마케팅비 증감 시뮬레이션

**장비 모드 활성화 (Phase 8)**:
- 장비별 리스료를 시설비에 포함
- 소모품과 장비 연결
- 장비별 사용 시간 추적
- 장비별 원가 배분

---

**문서 작성 완료**

전면 개편 이커머스 스타일 UX의 완벽한 구현 명세가 완성되었습니다.
모든 계산 로직, UX 흐름, 컴포넌트 구조, 디자인 패턴, 구현 가이드를 포함합니다.
