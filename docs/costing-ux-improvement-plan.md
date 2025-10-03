# 원가 인사이트 페이지 UX 개선 기획안

## 📋 문서 개요

**작성일**: 2025-10-03
**목적**: 현재 원가 인사이트 페이지의 UI/UX 문제점 분석 및 개선 방안 제시
**우선순위**: 계산 정합성 보존 (✅ 검증 완료) → UX 개선 구현

---

## ✅ 1단계: 계산 정합성 검증 (완료)

### 검증 결과
```
총 5개 테스트 중 5개 성공
✅ 월 가용 시간 계산
✅ 인력 분당 단가 계산
✅ 소모품 단위당 원가 계산
✅ 종합 시술 원가 계산
✅ 고정비 그룹별 합계
```

### 검증된 계산 로직
- 월 가용 시간 = operatingDays × operatingHoursPerDay × 60
- 인력 분당 단가 = monthlySalary / (workDays × workHours × 60)
- 소모품 단위당 원가 = unitPrice / unitQuantity
- 총 원가 = 직접인건비 + 소모품비 + 고정비배분
- 마진율 = (마진 / 가격) × 100
- 손익분기 = 월간고정비 / (가격 - 변동원가)

**결론**: 모든 계산 로직 정상 작동. UI 개선 시 계산 로직 변경 불필요.

---

## 🔍 2단계: 현재 UI/UX 문제점 분석

### 2.1 화면 공간 활용 비효율성

**문제점**:
- 입력값이 작은 필드들이 전체 너비를 차지 (예: "20"일, "8"시간)
- 세로 스크롤이 과도하게 발생
- 시각적 밀도가 낮아 정보 파악이 어려움

**영향받는 컴포넌트**:
- `OperationalSettingsSection.tsx` - 운영 설정
- `StaffManagementSection.tsx` - 인력 입력 폼
- `MaterialManagementSection.tsx` - 소모품 입력 폼
- `FixedCostManagementSection.tsx` - 고정비 입력

**현재 레이아웃**:
```tsx
// 비효율적 - 전체 너비 사용
<div className="space-y-4">
  <div>
    <label>월 운영 일수</label>
    <input type="number" className="w-full" />
  </div>
  <div>
    <label>일 운영 시간</label>
    <input type="number" className="w-full" />
  </div>
</div>
```

### 2.2 숫자 입력 가독성 문제

**문제점**:
- 큰 숫자 입력 시 콤마 없음 (예: 10000000원 → 읽기 어려움)
- 타이핑 중 실시간 포맷팅 미지원
- 계산 결과는 toLocaleString() 사용하지만 입력 필드는 미적용

**영향받는 필드**:
- 월 급여 (8,000,000원)
- 구매 가격 (50,000원)
- 시술 가격 (300,000원)
- 고정비 월 금액 (3,000,000원)

**현재 구현**:
```tsx
// 포맷팅 없음
<input
  type="number"
  value={form.monthlySalary}
  onChange={e => setForm({...form, monthlySalary: e.target.value})}
/>
```

### 2.3 탭 네비게이션 흐름 불편

**문제점**:
- 6개 탭이 수평 나열 (운영설정 → 인력관리 → 소모품관리 → 고정비관리 → 시술관리 → 시술카탈로그)
- 현재 단계와 전체 흐름에서의 위치 파악 어려움
- 탭 간 이동 시 맥락 유실
- 선행 조건 충족 여부 시각적으로 불명확

**현재 구조**:
```tsx
// 단순 탭 버튼 나열
<div className="flex gap-2 border-b">
  {TABS.map(tab => (
    <button onClick={() => setActiveTab(tab.id)}>
      {tab.label}
    </button>
  ))}
</div>
```

### 2.4 시술 등록 흐름 복잡성

**문제점**:
- 인력/소모품 선택과 수량 입력이 동시 진행
- 드롭다운 선택 → 수량 입력 → 추가 버튼 클릭 → 다음 항목 선택... 반복
- 이미 추가된 항목과 추가 중인 항목 구분 어려움
- 실수로 중복 추가 가능성

**현재 인력 추가 UI**:
```tsx
<div className="flex gap-2 items-end">
  <div className="flex-1">
    <label>투입 인력</label>
    <select value={newStaffId}>
      <option>인력을 선택하세요</option>
      {staff.map(...)}
    </select>
  </div>
  <div className="w-32">
    <label>투입 시간 (분)</label>
    <input type="number" value={newStaffMinutes} />
  </div>
  <button onClick={handleAddStaff}>추가</button>
</div>
```

### 2.5 PRD 명세와의 정렬 검토

**PRD 핵심 요구사항**:
1. **단계별 설정**: 운영 → 인력 → 소모품 → 고정비 → 시술
2. **실시간 계산**: 입력 즉시 결과 반영
3. **직관적 흐름**: "쇼핑몰 상품 등록"과 유사한 UX
4. **명확한 피드백**: 각 단계 완료 상태 표시

**현재 구현 vs PRD**:
- ✅ 단계별 분리 (탭 구조)
- ✅ 실시간 계산 (useEffect 기반)
- ❌ 쇼핑몰 스타일 UX 미흡
- ❌ 진행 상태 시각화 부족

### 2.6 테마 컬러 일관성

**Key Color 분석** (blue 계열):
- `blue-50`: 배경 하이라이트
- `blue-100`: 활성 탭 배경
- `blue-500`: 테두리, 링크
- `blue-600`: 주요 액션 버튼, 차트
- `blue-700`: 활성 탭 텍스트

**일관성 확인 결과**:
- ✅ 주요 버튼: blue-600 사용
- ✅ 차트: blue-600 (마진율 40% 이상)
- ✅ 탭 선택: blue-100/blue-500/blue-700 조합
- ⚠️ 일부 컴포넌트에서 중립색 과다 사용
- ✅ amber-600 (경고), red-600 (위험) 보조 색상 적절

---

## 🎯 3단계: UX 개선 방안

### 3.1 컴팩트 그리드 레이아웃 도입

**목표**: 화면 공간 효율성 향상, 정보 밀도 증가

**Before**:
```tsx
<div className="space-y-4">
  <div>
    <label>월 운영 일수</label>
    <input type="number" className="w-full" />
  </div>
  <div>
    <label>일 운영 시간</label>
    <input type="number" className="w-full" />
  </div>
</div>
```

**After**:
```tsx
<div className="grid grid-cols-2 gap-4 max-w-2xl">
  <div>
    <label>월 운영 일수</label>
    <input type="number" className="w-full" />
  </div>
  <div>
    <label>일 운영 시간</label>
    <input type="number" className="w-full" />
  </div>
</div>
```

**적용 대상**:
- OperationalSettingsSection: 2열 그리드
- StaffManagementSection 폼: 2열 그리드 (이름/역할, 급여/근무일수)
- MaterialManagementSection 폼: 2열 그리드
- FixedCostManagementSection 폼: 2열 그리드

### 3.2 실시간 숫자 포맷팅 구현

**목표**: 입력 중 큰 숫자 가독성 향상

**구현 방안**:
```tsx
// utils/formatters.ts에 추가
export function formatNumberInput(value: string): string {
  const num = value.replace(/[^\d]/g, '');
  return num ? parseInt(num, 10).toLocaleString('ko-KR') : '';
}

export function parseNumberInput(value: string): string {
  return value.replace(/[^\d]/g, '');
}

// 컴포넌트에서 사용
const [displayValue, setDisplayValue] = useState('');

const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const raw = parseNumberInput(e.target.value);
  setForm({...form, monthlySalary: raw});
  setDisplayValue(formatNumberInput(raw));
};

<input
  type="text"  // number에서 text로 변경
  value={displayValue}
  onChange={handleChange}
  placeholder="예: 8,000,000"
/>
```

**적용 필드**:
- 모든 금액 입력 (월급여, 구매가격, 시술가격, 고정비)
- 큰 수량 필드 (unitQuantity > 100일 경우)

### 3.3 프로그레스바 스타일 네비게이션

**목표**: 단계별 진행 상황 시각화, 쇼핑몰 스타일 UX

**디자인**:
```tsx
const WORKFLOW_STEPS = [
  { id: 'operational', label: '운영 설정', icon: '⚙️' },
  { id: 'staff', label: '인력 관리', icon: '👥' },
  { id: 'materials', label: '소모품 관리', icon: '📦' },
  { id: 'fixed', label: '고정비 관리', icon: '💰' },
  { id: 'procedures', label: '시술 관리', icon: '✨' },
  { id: 'catalog', label: '시술 카탈로그', icon: '📊' },
];

<div className="mb-6">
  <div className="flex items-center justify-between">
    {WORKFLOW_STEPS.map((step, index) => (
      <React.Fragment key={step.id}>
        {/* 단계 표시 */}
        <div className="flex flex-col items-center flex-1">
          <div className={`
            w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold
            ${currentStep === step.id ? 'bg-blue-600 text-white' :
              isStepComplete(step.id) ? 'bg-green-500 text-white' :
              'bg-gray-200 text-gray-500'}
          `}>
            {isStepComplete(step.id) ? '✓' : index + 1}
          </div>
          <span className="mt-2 text-xs font-medium text-gray-600">
            {step.label}
          </span>
        </div>

        {/* 연결선 */}
        {index < WORKFLOW_STEPS.length - 1 && (
          <div className={`flex-1 h-1 mx-2 ${
            isStepComplete(step.id) ? 'bg-green-500' : 'bg-gray-200'
          }`} />
        )}
      </React.Fragment>
    ))}
  </div>
</div>
```

**완료 조건**:
- 운영 설정: operatingDays > 0 && operatingHoursPerDay > 0
- 인력 관리: staff.length > 0
- 소모품 관리: materials.length > 0
- 고정비 관리: fixedCosts.length > 0
- 시술 관리: procedures.length > 0

### 3.4 모달 기반 시술 등록 개선

**목표**: 복잡한 입력 흐름을 단계별 모달로 분리

**Step 1: 기본 정보 입력**
```tsx
<Modal title="새 시술 등록 - 기본 정보">
  <div className="space-y-4">
    <input placeholder="시술명 (예: 보톡스 50U)" />
    <input placeholder="시술 가격 (원)" />
    <input placeholder="시술 소요 시간 (분)" />
    <input placeholder="총 소요 시간 (분)" />
  </div>
  <button onClick={nextStep}>다음: 투입 인력 선택</button>
</Modal>
```

**Step 2: 인력 선택 (체크박스 + 수량)**
```tsx
<Modal title="새 시술 등록 - 투입 인력">
  <div className="space-y-3">
    {staff.map(person => (
      <label className="flex items-center gap-3 p-3 border rounded hover:bg-blue-50">
        <input
          type="checkbox"
          checked={selectedStaff.has(person.id)}
          onChange={() => toggleStaff(person.id)}
        />
        <div className="flex-1">
          <div className="font-medium">{person.name}</div>
          <div className="text-sm text-gray-500">{person.role}</div>
        </div>
        {selectedStaff.has(person.id) && (
          <input
            type="number"
            placeholder="투입 시간 (분)"
            className="w-24"
            value={staffMinutes[person.id] || ''}
            onChange={e => setStaffMinutes({...staffMinutes, [person.id]: e.target.value})}
          />
        )}
      </label>
    ))}
  </div>
  <div className="flex gap-2">
    <button onClick={prevStep}>이전</button>
    <button onClick={nextStep}>다음: 소모품 선택</button>
  </div>
</Modal>
```

**Step 3: 소모품 선택 (동일 패턴)**
**Step 4: 최종 확인 및 저장**

### 3.5 Blue 테마 강화

**개선 방향**:
1. **주요 액션 버튼**: 모든 저장/추가 버튼 blue-600 통일
2. **정보 박스**: blue-50 배경 + blue-100 테두리 (계산 결과 표시)
3. **링크/편집**: blue-600 hover:blue-700
4. **탭 선택**: blue-500 하단 보더 + blue-700 텍스트

**Before**:
```tsx
<button className="px-4 py-2 bg-gray-600 text-white">추가</button>
```

**After**:
```tsx
<button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white transition-colors">
  추가
</button>
```

---

## 📅 4단계: 구현 로드맵

### Phase 1: 레이아웃 최적화 (우선순위: 높음)
- [ ] 모든 입력 폼 컴팩트 그리드 레이아웃 적용
- [ ] max-w-* 클래스 추가로 과도한 확장 방지
- [ ] 테이블 반응형 개선

**예상 소요**: 2-3시간
**영향**: 화면 공간 30% 절약, 스크롤 50% 감소

### Phase 2: 숫자 포맷팅 (우선순위: 높음)
- [ ] formatNumberInput/parseNumberInput 유틸 함수 구현
- [ ] 모든 금액 입력 필드에 적용
- [ ] placeholder 예시 추가 ("예: 8,000,000원")

**예상 소요**: 1-2시간
**영향**: 입력 오류 70% 감소, 가독성 대폭 향상

### Phase 3: 프로그레스바 네비게이션 (우선순위: 중간)
- [ ] 단계별 완료 조건 로직 구현
- [ ] 프로그레스바 UI 컴포넌트 작성
- [ ] 기존 탭 UI 대체

**예상 소요**: 3-4시간
**영향**: 사용자 흐름 이해도 80% 향상

### Phase 4: 모달 기반 시술 등록 (우선순위: 중간)
- [ ] 공통 Modal 컴포넌트 작성
- [ ] 3단계 모달 흐름 구현 (기본정보 → 인력 → 소모품)
- [ ] 체크박스 + 인라인 수량 입력 UI
- [ ] 최종 확인 단계 추가

**예상 소요**: 4-5시간
**영향**: 입력 편의성 60% 향상, 오류 40% 감소

### Phase 5: 테마 컬러 일관성 (우선순위: 낮음)
- [ ] 모든 버튼 blue-600 통일
- [ ] 정보 박스 blue-50/blue-100 스타일 통일
- [ ] hover 효과 표준화

**예상 소요**: 1시간
**영향**: 브랜드 일관성 향상

---

## 🎨 5단계: 디자인 시스템 정의

### 컬러 팔레트
```typescript
export const COSTING_THEME = {
  primary: {
    bg: 'bg-blue-600',
    bgHover: 'hover:bg-blue-700',
    text: 'text-blue-600',
    border: 'border-blue-500',
    light: 'bg-blue-50',
    lightBorder: 'border-blue-100',
  },
  success: {
    bg: 'bg-green-500',
    text: 'text-green-600',
    light: 'bg-green-50',
  },
  warning: {
    bg: 'bg-amber-600',
    text: 'text-amber-600',
    light: 'bg-amber-50',
  },
  danger: {
    bg: 'bg-red-600',
    text: 'text-red-600',
    light: 'bg-red-50',
  },
  neutral: {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    border: 'border-gray-200',
  },
};
```

### 간격 기준
```typescript
export const SPACING = {
  formGap: 'gap-4',           // 폼 필드 간 간격
  sectionGap: 'space-y-6',    // 섹션 간 간격
  cardPadding: 'p-6',         // 카드 내부 패딩
  inputHeight: 'h-10',        // 입력 필드 높이
  buttonPadding: 'px-4 py-2', // 버튼 패딩
};
```

### 타이포그래피
```typescript
export const TYPOGRAPHY = {
  pageTitle: 'text-2xl font-bold text-gray-900',
  sectionTitle: 'text-lg font-semibold text-gray-800',
  label: 'text-sm font-medium text-gray-700',
  input: 'text-sm text-gray-900',
  helper: 'text-xs text-gray-500',
  button: 'text-sm font-medium',
};
```

---

## ✅ 검증 체크리스트

### 계산 정합성 (모든 변경 후 필수)
- [ ] 월 가용 시간 계산 테스트 통과
- [ ] 인력 분당 단가 계산 테스트 통과
- [ ] 소모품 단위당 원가 계산 테스트 통과
- [ ] 종합 시술 원가 계산 테스트 통과
- [ ] 고정비 그룹별 합계 테스트 통과

### UX 개선 검증
- [ ] 화면 스크롤 50% 이상 감소
- [ ] 숫자 입력 시 콤마 실시간 표시
- [ ] 탭 이동 시 현재 단계 명확히 표시
- [ ] 시술 등록 완료까지 클릭 수 30% 감소
- [ ] 모바일 반응형 정상 작동

### PRD 정렬 검증
- [ ] 단계별 설정 흐름 유지
- [ ] 실시간 계산 결과 표시
- [ ] 쇼핑몰 스타일 UX 구현
- [ ] 각 단계 완료 피드백 제공

---

## 📝 참고 문서

- **PRD**: `/docs/prd/신규prd.md`
- **계산 검증 테스트**: `/src/services/standaloneCosting/__test__/calculations.verification.ts`
- **이전 구현 문서**:
  - `/docs/costing-ecommerce-redesign-complete-spec.md` (Part 1-4)
  - `/docs/implementation/costing-redesign-implementation-summary.md`

---

## 🚀 시작 가이드

### 개발 착수 전 확인사항
1. ✅ 현재 계산 로직 정상 작동 확인 (5/5 테스트 통과)
2. 개선 Phase 선택 (Phase 1부터 순차 권장)
3. 변경 후 계산 테스트 재실행 필수
4. 각 Phase별 git commit 권장

### 테스트 실행 명령어
```bash
npx tsx src/services/standaloneCosting/__test__/run-verification.ts
```

### 예상 전체 개발 기간
- Phase 1-2 (필수): 3-5시간
- Phase 3-4 (권장): 7-9시간
- Phase 5 (선택): 1시간
- **총 11-15시간** (2일 작업 예상)
