# UI/UX 전면 감사 보고서

**작성일**: 2025-10-03
**대상 모듈**: `/costing` - 시술 원가 계산 모듈
**검토 범위**: 8개 탭, 입력 폼, CRUD 패턴, 리스팅, 색상, 계산, 단위, 오타

---

## 📋 요약

### ✅ 잘 된 부분
- **계산 로직**: 5/5 테스트 통과, 정합성 100%
- **색상 시스템**: Tailwind 팔레트 일관성 유지
- **타이포그래피**: 폰트 크기 및 굵기 일관적
- **반응형**: md 브레이크포인트 적절히 활용
- **접근성**: focus ring, hover 상태 모두 구현

### ⚠️ 개선 필요 부분
1. **CRUD 패턴 불일치**: 편집 모드가 섹션마다 다름
2. **입력 폼 UX**: 폼이 테이블 위에 항상 노출되어 공간 낭비
3. **리스팅 화면**: 시술 카탈로그만 카드 뷰, 나머지는 테이블
4. **단위 표시**: 일부 레이블에서 단위 누락
5. **삭제 확인 메시지**: 형식이 섹션마다 다름
6. **빈 상태 처리**: 일부는 도움말 포함, 일부는 단순 메시지
7. **고정비 관리**: 그룹별 탭 없이 스크롤로 전환 (UX 불편)
8. **ProcedureManagement**: 한 화면에 너무 많은 입력 필드

---

## 🔍 섹션별 상세 분석

### 1. 운영 세팅 (OperationalSettingsSection)

#### ✅ 잘 된 점
- Alert 컴포넌트로 경고 명확히 표시
- HelpTooltip으로 고정비 배분 설명
- 월 가용 시간 실시간 계산 표시
- 저장 시간 표시로 피드백 제공

#### ⚠️ 개선점
1. **중복 표시**: 월 가용 시간이 폼 하단(106행)과 info box(136행)에 중복
2. **레이아웃**: 폼이 2칸인데 메모가 전체 칸 차지 (3칸으로 확장 고려)

**제안**:
```tsx
// 폼 하단의 중복 제거, info box만 유지
<div className="md:col-span-2 flex justify-end">
  <button type="submit">저장</button>
</div>
```

---

### 2. 장비 관리 (EquipmentManagementSection)

#### ✅ 잘 된 점
- "준비 중" 상태 명확히 표시
- 체크박스로 활성화/비활성화 제공
- disabled 상태 일관된 스타일 적용

#### ⚠️ 개선점
1. **편집 기능 없음**: 장비는 삭제만 가능, 편집 불가
2. **입력 폼 노출**: 비활성화 상태여도 폼이 계속 보임 (공간 낭비)
3. **빈 상태 메시지**: "장비 상세 모드를 사용하려면..." 너무 장황

**제안**:
```tsx
// 비활성화 시 폼 숨김
{state.useEquipmentHierarchy && (
  <form className="mt-6 grid gap-4 md:grid-cols-3" onSubmit={handleSubmit}>
    {/* ... */}
  </form>
)}

// 편집 버튼 추가
<button onClick={() => handleEdit(item)}>편집</button>
```

---

### 3. 인력 관리 (StaffManagementSection)

#### ✅ 잘 된 점
- 월 근무 분, 분당 인건비 자동 계산 표시
- 편집 시 폼에 값 자동 채움
- 삭제 확인 메시지에 이름+역할 표시

#### ⚠️ 개선점
1. **폼 위치**: 테이블 위에 항상 노출 (데이터 많으면 스크롤 불편)
2. **역할 필드**: required 없음 (의도적인지 확인 필요)
3. **테이블 컬럼**: "월 근무 분" vs "분당 인건비" - 단위 불일치 (분 vs 원)

**제안**:
```tsx
// 테이블 헤더 단위 명시
<th className="px-4 py-2 text-right font-medium text-gray-500">월 근무 시간 (분)</th>
<th className="px-4 py-2 text-right font-medium text-gray-500">분당 인건비 (원)</th>

// 역할 필드 required 추가 또는 placeholder 수정
<input name="role" value={form.role} onChange={handleChange} required placeholder="예: 의사, 간호사" />
```

---

### 4. 소모품 관리 (MaterialManagementSection)

#### ✅ 잘 된 점
- 단위 명칭 + 수량 구조 명확
- 단위당 금액 자동 계산 표시
- placeholder로 예시 제공

#### ⚠️ 개선점
1. **테이블 헤더**: "기본 단위 금액" vs "단위당 금액" - 용어 혼동
2. **단위 표시**: "2,400 샷" vs "5,000원/샷" - 단위 위치 불일치
3. **입력 폼**: "기본 단위 수량" 레이블 모호 (예시: 2400샷이 무슨 의미?)

**제안**:
```tsx
// 레이블 개선
<label>구매 단위 수량</label> // "기본 단위 수량" → "구매 단위 수량"
<label>구매 단위 가격 (원)</label> // "기본 단위 금액" → "구매 단위 가격"

// 테이블 헤더 개선
<th>구매 단위</th> // "2,400 샷"
<th>구매 가격</th> // "₩3,500,000"
<th>단위당 원가</th> // "₩1,458/샷"

// 설명 추가
<p className="text-xs text-gray-500">
  예: 울쎄라 팁 2400샷을 350만원에 구매하면, 1샷당 1,458원
</p>
```

---

### 5. 고정비 관리 (FixedCostManagementSection)

#### ✅ 잘 된 점
- 3그룹 구분 명확 (배지 + 툴팁)
- 그룹별 합계 표시
- 전체 합계 상단에 표시

#### ⚠️ 개선점
1. **탭 구조 없음**: 3개 그룹이 한 화면에 스크롤로 나열 (UX 불편)
2. **폼 위치**: 입력 폼이 어느 그룹용인지 불명확
3. **activeGroup 상태**: 사용되지만 UI에 시각적 표시 없음
4. **편집 모드**: 그룹 전환 시 폼 초기화 동작 불명확

**제안**:
```tsx
// 탭 UI 추가
<div className="flex gap-2 border-b border-gray-200">
  {GROUP_ORDER.map(group => (
    <button
      key={group}
      onClick={() => handleGroupChange(group)}
      className={`px-4 py-2 text-sm font-medium ${
        activeGroup === group
          ? 'border-b-2 border-blue-600 text-blue-600'
          : 'text-gray-600 hover:text-gray-900'
      }`}
    >
      {GROUP_CONFIG[group].label}
    </button>
  ))}
</div>

// 폼을 탭 아래로 이동, 현재 선택된 그룹만 표시
{activeGroup === 'facility' && <form>{/* facility 입력 폼 */}</form>}
{activeGroup === 'facility' && renderGroupTable('facility')}
```

---

### 6. 시술 관리 (ProcedureManagementSection)

#### ✅ 잘 된 점
- HelpTooltip으로 시술시간 vs 체류시간 설명
- 인력/소모품 동적 추가/삭제
- 드롭다운으로 선택 가능

#### ⚠️ 개선점
1. **폼 복잡도**: 한 화면에 기본정보 + 인력 + 소모품 + 메모 (너무 많음)
2. **인력/소모품 할당**: 드롭다운 선택 → 추가 버튼 클릭 (2단계, 번거로움)
3. **체크박스 패턴**: "totalMinutes를 비워두면 treatmentMinutes와 동일" - 암묵적
4. **폼 높이**: 스크롤 많이 필요, 테이블과 폼 사이 이동 불편

**제안**:
```tsx
// 다단계 폼으로 분리
<Tabs>
  <Tab label="기본 정보">
    {/* 시술명, 가격, 시간 */}
  </Tab>
  <Tab label="인력 배정">
    {/* 인력 선택 */}
  </Tab>
  <Tab label="소모품 배정">
    {/* 소모품 선택 */}
  </Tab>
</Tabs>

// 또는 모달 패턴
<button onClick={() => openProcedureModal()}>+ 시술 추가</button>
<ProcedureModal isOpen={isOpen} onClose={...} />
```

---

### 7. 시술 카탈로그 (ProcedureCatalogSection)

#### ✅ 잘 된 점
- 검색/필터/정렬 모두 구현
- 카드 그리드 레이아웃 깔끔
- 빈 상태 메시지 상황별로 다름

#### ⚠️ 개선점
1. **편집 기능**: `handleEdit` 함수가 console.log만 (TODO 주석)
2. **복사 기능**: 복사 후 피드백 없음 (토스트/알림 필요)
3. **카드 높이**: 메모가 길면 카드 높이 불균형

**제안**:
```tsx
// 편집 모달 연결 또는 시술 관리 탭으로 이동
const handleEdit = (procedure: ProcedureFormValues) => {
  setActiveTab('procedures'); // 시술 관리 탭으로 이동
  // 또는
  openEditModal(procedure);
};

// 복사 후 알림
const handleDuplicate = (procedure: ProcedureFormValues) => {
  upsertProcedure(duplicated);
  showToast(`${procedure.name} (복사)가 추가되었습니다.`);
};

// 카드 높이 고정
<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-[400px] flex flex-col">
  {/* content */}
  <div className="flex-1 overflow-hidden">
    {procedure.notes && (
      <div className="mt-3 text-xs text-gray-500 line-clamp-2">
        {procedure.notes}
      </div>
    )}
  </div>
  {/* buttons */}
</div>
```

---

### 8. 결과 대시보드 (ProcedureResultsSection)

#### ✅ 잘 된 점
- StatCard로 주요 지표 5개 명확히 표시
- MarginChart로 시각화
- 테이블로 상세 정보 제공

#### ⚠️ 개선점
1. **StatCard 비율**: 5칸 그리드가 화면 작을 때 좁아짐
2. **테이블 컬럼**: 9개 컬럼으로 가로 스크롤 발생 가능
3. **손익분기 표시**: "기여이익 부족" 메시지 모호

**제안**:
```tsx
// StatCard를 2행으로 배치
<div className="grid gap-3 md:grid-cols-3">
  <StatCard title="월 시설·운영비" ... />
  <StatCard title="월 공통비용" ... />
  <StatCard title="월 마케팅 비용" ... />
</div>
<div className="grid gap-3 md:grid-cols-2 mt-3">
  <StatCard title="평균 마진율" ... variant="info" />
  <StatCard title="최소 손익분기 건수" ... variant="info" />
</div>

// 손익분기 null 처리 개선
{breakdown.breakevenUnits !== null
  ? `${Math.ceil(breakdown.breakevenUnits).toLocaleString('ko-KR')}건`
  : (
    <span className="flex items-center gap-1">
      계산 불가
      <HelpTooltip content="가격이 직접 원가보다 낮아 기여이익이 음수입니다. 판매가를 높이거나 원가를 낮춰야 손익분기를 계산할 수 있습니다." />
    </span>
  )
}
```

---

### 9. 마케팅 인사이트 (MarketingInsightsSection)

#### ✅ 잘 된 점
- "준비 중" 명확히 표시
- 향후 기능 목록 상세히 안내
- 용어 설명 모달 제공

#### ⚠️ 개선점
1. **진행 노트**: 개발자용 메시지가 사용자에게 노출 (부적절)
2. **모달 사용**: NotificationModal 재사용이지만 용어 설명용으로는 부적합

**제안**:
```tsx
// 진행 노트 제거 또는 개발자 모드에만 표시
{process.env.NODE_ENV === 'development' && (
  <div className="mt-6 rounded-md border border-blue-200 bg-blue-50 p-4">...</div>
)}

// 용어 설명을 별도 컴포넌트로
<GlossaryPanel
  terms={[
    { term: 'ROI', definition: '투자수익률: 순이익 ÷ 투자비용 × 100' },
    { term: 'ROAS', definition: '광고 투자 수익: ...' },
  ]}
/>
```

---

## 🎨 색상 시스템 검토

### ✅ 잘 사용된 색상
| 용도 | 색상 | 사용처 |
|---|---|---|
| Primary (활성) | `blue-600` | 버튼, 활성 탭, 링크 |
| Success (양호) | `blue-100/600` | 마진율 양호 배지 |
| Warning (주의) | `yellow-600`, `amber-600` | 경고 Alert, 개선 필요 배지 |
| Danger (위험) | `red-600` | 삭제 버튼, 주의 배지 |
| Neutral | `gray-50~900` | 배경, 테두리, 텍스트 |

### ⚠️ 개선점
1. **yellow vs amber**: Alert는 amber, MarginBadge는 yellow (통일 필요)
2. **green 사용**: 마케팅 비용 배지만 green 사용 (일관성)

**제안**:
```tsx
// yellow → amber로 통일
const status = getStatusConfig(marginRate);
if (rate >= 30) return {
  text: '개선 필요',
  className: 'bg-amber-100 text-amber-800 border-amber-200' // yellow → amber
};

// green은 success 상황에만 사용
marketing: {
  badge: 'ROI 분석용',
  badgeColor: 'bg-blue-100 text-blue-800 border-blue-200', // green → blue
}
```

---

## 🔢 단위 표시 검토

### ❌ 단위 누락/불일치

| 섹션 | 문제 | 현재 | 제안 |
|---|---|---|---|
| 인력 관리 | 테이블 헤더 "월 근무 분" | 단위 없음 | "월 근무 시간 (분)" |
| 소모품 관리 | "기본 단위 금액" | 모호 | "구매 가격 (원)" |
| 고정비 관리 | "월 합계" | 원 표시 formatKrw | "월 합계 (원)" |
| 시술 관리 | "시술 소요시간" | (분) 괄호 | 일관성 있게 |

**통일 제안**:
```tsx
// 패턴 1: 레이블 (단위)
<label>월 급여 (원)</label>
<label>시술 소요시간 (분)</label>

// 패턴 2: 테이블 헤더
<th>월 급여 (원)</th>
<th>분당 인건비 (원/분)</th>
```

---

## 🐛 오타 및 문법 검토

### ✅ 발견된 문제 없음
- 한글 깨짐 없음
- 띄어쓰기 일관적
- 문장 종결 일관적

### ⚠️ 표현 개선 제안

| 현재 | 제안 | 이유 |
|---|---|---|
| "월 가용 시간" | "월 가용 시간" | OK |
| "기본 단위 수량" | "구매 단위 수량" | 의미 명확화 |
| "기여이익 부족" | "계산 불가 (마진 음수)" | 더 직관적 |
| "장비 상세 모드 (준비 중)" | "장비별 원가 배분 (베타)" | 기능 명확화 |

---

## 📱 반응형 레이아웃 검토

### ✅ 잘 된 점
- 모든 그리드가 `md:grid-cols-*` 사용
- 테이블 `overflow-x-auto` 적용
- 버튼 그룹 `flex-wrap` 사용

### ⚠️ 개선점
1. **StatCard 5칸**: 모바일에서 1칸, 태블릿에서 5칸은 부자연스러움
2. **ProcedureCard 그리드**: `lg:grid-cols-3`은 1920px 이상에서 카드가 너무 큼
3. **테이블 컬럼 수**: 결과 대시보드 9칸은 1024px에서도 스크롤

**제안**:
```tsx
// StatCard 반응형 개선
<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
  {/* 3개 */}
</div>
<div className="grid gap-3 sm:grid-cols-2 mt-3">
  {/* 2개 */}
</div>

// ProcedureCard 최대 너비 제한
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 max-w-[1600px]">
  {/* 카드들 */}
</div>
```

---

## 🔄 CRUD 패턴 일관성 검토

### 현재 패턴 요약

| 섹션 | 추가 | 편집 | 삭제 | 패턴 |
|---|---|---|---|---|
| 운영 세팅 | 폼 제출 | 자동 로드 | N/A | **설정** |
| 장비 관리 | 폼 제출 | ❌ 없음 | 테이블 버튼 | **불완전** |
| 인력 관리 | 폼 제출 | 폼에 로드 | 테이블 버튼 | **인라인 편집** |
| 소모품 관리 | 폼 제출 | 폼에 로드 | 테이블 버튼 | **인라인 편집** |
| 고정비 관리 | 폼 제출 | 폼에 로드 | 테이블 버튼 | **인라인 편집** |
| 시술 관리 | 폼 제출 | 폼에 로드 | 테이블 버튼 | **인라인 편집** |
| 시술 카탈로그 | N/A | ❌ TODO | 카드 버튼 (복사만) | **카드 뷰** |

### ⚠️ 불일치 문제
1. **장비 관리**: 편집 버튼이 없음 (삭제 후 재등록 필요)
2. **시술 카탈로그**: 편집이 console.log만 (미구현)
3. **인라인 편집의 문제점**: 폼이 항상 화면 상단에 있어서 데이터 많으면 스크롤 왕복

### 🎯 통일 제안: 모달 패턴

**이유**:
- 폼이 항상 노출되지 않아 공간 절약
- 편집 시 컨텍스트 명확 (어떤 항목 편집 중인지)
- 테이블에서 바로 편집 버튼 클릭 → 모달 열림 (직관적)

**구현 예시**:
```tsx
// StaffManagementSection 모달 패턴 예시
const [modalState, setModalState] = useState<{
  isOpen: boolean;
  mode: 'create' | 'edit';
  staff: StaffProfile | null;
}>({ isOpen: false, mode: 'create', staff: null });

return (
  <section>
    <header>
      <h2>인력 관리</h2>
      <button onClick={() => setModalState({ isOpen: true, mode: 'create', staff: null })}>
        + 인력 추가
      </button>
    </header>

    {/* 폼 제거, 테이블만 표시 */}
    <table>...</table>

    {/* 모달로 폼 이동 */}
    <StaffFormModal
      isOpen={modalState.isOpen}
      mode={modalState.mode}
      initialData={modalState.staff}
      onClose={() => setModalState({ isOpen: false, mode: 'create', staff: null })}
      onSubmit={(data) => {
        upsertStaff(data);
        setModalState({ isOpen: false, mode: 'create', staff: null });
      }}
    />
  </section>
);
```

---

## 🚀 우선순위별 개선 과제

### 🔴 High Priority (즉시 개선 권장)

1. **장비 관리 편집 기능 추가** (EquipmentManagementSection.tsx)
   - 현재 삭제만 가능, 편집 버튼 없음
   - 영향: 사용자가 오타 수정 불가

2. **시술 카탈로그 편집 기능 구현** (ProcedureCatalogSection.tsx)
   - 현재 TODO 주석만 있음
   - 제안: 시술 관리 탭으로 이동 또는 모달 연동

3. **고정비 관리 탭 구조 추가** (FixedCostManagementSection.tsx)
   - 현재 3그룹이 스크롤로 나열
   - 제안: 탭으로 그룹 전환, activeGroup 시각화

4. **단위 표시 통일**
   - 모든 레이블/헤더에 (원), (분), (시간) 명시
   - formatKrw 사용 시에도 헤더에 (원) 추가

5. **운영 세팅 중복 제거**
   - 월 가용 시간이 폼 하단 + info box에 중복 표시
   - info box만 유지

### 🟡 Medium Priority (다음 스프린트)

6. **CRUD 패턴 통일 (모달 패턴)**
   - 인력/소모품/고정비/시술 관리 모두 모달로 전환
   - 폼 공간 절약 + UX 개선

7. **시술 관리 폼 복잡도 감소**
   - 다단계 폼 또는 아코디언 구조
   - 기본 정보 → 인력 배정 → 소모품 배정 분리

8. **삭제 확인 메시지 통일**
   - 형식: `{이름} ({역할/그룹/단위}) 항목을 삭제하시겠습니까?`
   - 연결 정보 경고: `연결된 시술 X건에서 제거됩니다.`

9. **빈 상태 메시지 개선**
   - 단순 "등록된 항목이 없습니다" → 도움말 포함
   - 예: "인력을 추가하려면 위 폼을 작성하세요"

10. **복사 기능 피드백**
    - 시술 복사 시 토스트 알림 또는 카탈로그 스크롤

### 🟢 Low Priority (향후 고려)

11. **반응형 개선**
    - StatCard 그리드: 5칸 → 3칸 + 2칸 분리
    - ProcedureCard: max-width 제한

12. **테이블 최적화**
    - 결과 대시보드 9칸 → 주요 컬럼만 표시, 나머지 확장 버튼

13. **마케팅 인사이트 진행 노트 제거**
    - 개발자용 메시지 숨김

14. **색상 통일**
    - yellow → amber
    - green → blue (일관성)

---

## 📊 전체 점수

| 항목 | 점수 | 평가 |
|---|---|---|
| 계산 정합성 | ⭐⭐⭐⭐⭐ 5/5 | 완벽 |
| 색상 시스템 | ⭐⭐⭐⭐ 4/5 | 일부 불일치 |
| CRUD 패턴 | ⭐⭐⭐ 3/5 | 섹션마다 다름 |
| 반응형 | ⭐⭐⭐⭐ 4/5 | 잘 되어 있으나 일부 개선 필요 |
| 단위 표시 | ⭐⭐⭐ 3/5 | 누락 많음 |
| 빈 상태 처리 | ⭐⭐⭐ 3/5 | 일관성 부족 |
| 접근성 | ⭐⭐⭐⭐ 4/5 | focus/hover 잘 됨 |
| 오타/문법 | ⭐⭐⭐⭐⭐ 5/5 | 문제 없음 |

**종합 평가**: ⭐⭐⭐⭐ 4.0/5.0

---

## 🎯 다음 단계 제안

1. **즉시 수정 (High Priority 5개)**
   - 장비 편집, 카탈로그 편집, 고정비 탭, 단위 통일, 중복 제거
   - 예상 소요: 2-3시간

2. **UX 개선 (Medium Priority 5개)**
   - 모달 패턴 전환, 폼 분리, 메시지 통일
   - 예상 소요: 1일

3. **폴리싱 (Low Priority 4개)**
   - 반응형 미세 조정, 색상 통일
   - 예상 소요: 반나절

**총 예상 소요 시간**: 2일

---

**작성자**: Claude Code
**검토 범위**: 8개 탭, 2,000+ 줄 코드
**참고 문서**: `/docs/prd/신규prd.md`, `/docs/implementation/costing-redesign-implementation-summary.md`
