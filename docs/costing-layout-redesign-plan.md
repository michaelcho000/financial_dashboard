# 원가 인사이트 페이지 레이아웃 재설계 Plan

## 📋 문서 개요

**작성일**: 2025-10-03
**목적**: 입력 폼과 리스팅 테이블의 레이아웃 일관성 확보 및 CRUD 흐름 재설계
**배경**: 현재 폼만 축소되고 테이블은 전체 너비를 사용하여 구조적 비일관성 발생

---

## ⚠️ 최우선 원칙: 계산 정합성 보존

**CRITICAL**: 이 문서의 모든 레이아웃 변경사항은 **계산 로직에 전혀 영향을 주지 않아야 합니다.**

### 계산 정합성 검증 프로토콜

**필수 규칙**:
1. ✅ **각 Phase 완료 시마다** 계산 테스트 실행 (5/5 통과 필수)
2. ✅ **UI 변경은 순수 View Layer만** 수정 (계산 로직 절대 수정 금지)
3. ✅ **테스트 실패 시 즉시 롤백** (계산 정합성 > 레이아웃 개선)

**검증 명령어**:
```bash
npx tsx src/services/standaloneCosting/__test__/run-verification.ts
```

**검증 항목 (모두 PASS 필수)**:
- ✅ 월 가용 시간 계산
- ✅ 인력 분당 단가 계산
- ✅ 소모품 단위당 원가 계산
- ✅ 종합 시술 원가 계산
- ✅ 고정비 그룹별 합계

**계산 로직 파일 (절대 수정 금지)**:
- `/src/services/standaloneCosting/calculations.ts`
- `/src/services/standaloneCosting/types.ts`
- `/src/services/standaloneCosting/__test__/calculations.verification.ts`

**수정 허용 범위**:
- ✅ JSX 구조 변경 (폼 → 모달 이동)
- ✅ CSS 클래스 변경
- ✅ 상태 관리 구조 변경 (useState, Modal 상태)
- ✅ 이벤트 핸들러 위치 변경
- ❌ 계산 로직 수정 (절대 불가)
- ❌ 저장 함수의 계산 부분 수정 (절대 불가)
- ❌ Provider의 계산 관련 로직 수정 (절대 불가)

---

## 🔍 현재 문제점 분석

### 1. 레이아웃 비일관성

**현재 상태**:
```tsx
// 폼 영역 - 제한된 너비
<form className="grid gap-4 md:grid-cols-2 max-w-2xl">
  {/* 입력 필드들 */}
</form>

// 테이블 영역 - 전체 너비 사용
<div className="mt-6 overflow-x-auto">
  <table className="min-w-full divide-y divide-gray-200">
    {/* 테이블 */}
  </table>
</div>
```

**문제점**:
- 폼은 좌측에 몰려있고, 테이블은 전체 너비 사용
- 시각적 흐름이 깨짐 (좁은 폼 → 넓은 테이블)
- 카드 영역(`section`)도 전체 너비 사용하여 공간 낭비
- 사용자가 시선을 좌우로 크게 이동해야 함

### 2. CRUD 패턴 부재

**현재 구조** (모든 섹션이 동일한 패턴):
```
[섹션 헤더]
[입력 폼 + 저장 버튼]
[구분선]
[전체 리스트 테이블]
```

**문제점**:
- 등록 폼과 리스팅이 항상 함께 표시되어 혼잡
- 편집 시 폼이 테이블 위에 있어 컨텍스트 유실
- 긴 리스트일 경우 폼을 다시 보려면 스크롤 필요
- "등록 중심" vs "관리 중심" 모드 구분 없음

### 3. 화면 공간 활용 비효율

**통계**:
- 운영 설정: 입력 필드 2개 → 섹션 카드는 전체 너비
- 인력 관리: 입력 필드 5개 → 테이블은 7개 컬럼 (전체 너비 필요)
- 소모품 관리: 입력 필드 4개 → 테이블은 5개 컬럼
- 고정비 관리: 입력 필드 2개 → 테이블은 4개 컬럼
- 시술 관리: 복잡한 다단계 폼 → 컨텍스트 유실 심각

**결론**:
- 간단한 설정은 모달로 처리하는 것이 효율적
- 복잡한 관리는 리스팅 중심 + 모달/사이드바 편집
- 분석/카탈로그는 전체 화면 활용

---

## 🌐 E-commerce Admin Panel 베스트 프랙티스 리서치 결과

### Modal vs Separate Page vs Sidebar 패턴 선택 기준

#### 🔹 Modal이 적합한 경우:
- **짧고 자기 완결적인 작업** (예: 결제 정보 업데이트, 간단한 항목 추가)
- **필드가 5개 이하**로 한 화면에 모두 표시 가능
- **빠른 입력 후 즉시 리스트 확인**이 필요한 경우
- **동시 편집 충돌 체크**가 필요한 경우
- **장점**: 컨텍스트 유지, 빠른 작업, 개발 용이
- **단점**: 약간 disruptive, 스크롤 제한

**원가 인사이트 적용 대상**:
- ✅ 운영 설정 (2개 필드 + 메모)
- ✅ 인력 추가/편집 (5개 필드 + 메모)
- ✅ 소모품 추가/편집 (4개 필드 + 메모)
- ✅ 고정비 추가/편집 (2개 필드 + 메모)

#### 🔹 Sidebar 패턴이 적합한 경우:
- **많은 공간이 필요**하고 스크롤이나 서브탭 필요
- **테이블 컨텍스트를 유지하면서 편집**이 중요
- **복잡한 폼이지만 리스트를 동시에 봐야 하는 경우**
- **장점**: 가장 확장 가능, 컨텍스트 유지 우수
- **단점**: 좁은 화면에서 불편, 개발 복잡도 증가

**원가 인사이트 적용 대상**:
- 🤔 시술 추가/편집 (기본정보 5개 + 인력 선택 + 소모품 선택)
  - 대안: 다단계 모달 (Step 1: 기본정보 → Step 2: 인력 → Step 3: 소모품)

#### 🔹 Separate Page가 적합한 경우:
- **매우 복잡한 폼** (필드 20개 이상, 여러 섹션)
- **실수로 인한 업데이트 방지**가 중요
- **사용자가 완전히 작업에 집중**해야 하는 경우

**원가 인사이트 적용 대상**:
- ❌ 해당 없음 (모든 폼이 충분히 간단함)

### Shopify Admin 패턴 분석

**핵심 인사이트**:
1. **Transactional workflows는 모달 사용**
   - "More actions" 메뉴나 bulk action에서 모달 실행
   - 모달은 sidebar와 top bar를 가리는 overlay
   - iframe으로 렌더링하여 격리

2. **Admin actions - 리스트에서 직접 액션**
   - 인덱스 테이블의 bulk action 메뉴
   - 한 개 이상 선택 시 모달 표시

3. **UI 패턴**:
   - Touch targets 44–48px
   - 스와이프 액션, 배치 선택, 풀 투 리프레시
   - Optimistic UI with safe rollback

### Enterprise Data Table 베스트 프랙티스

**주요 원칙**:
1. **Clear action hierarchy**
   - Primary action: "Create New" 버튼 (우측 상단)
   - Row actions: 편집/삭제 (각 행의 우측)
   - Bulk actions: 선택된 항목에 대한 액션 (상단 고정바)

2. **Context preservation**
   - 편집 시 원본 데이터 계속 표시
   - 모달/사이드바로 컨텍스트 유지

3. **Responsive table patterns**
   - 좁은 화면: 카드 뷰로 전환
   - 넓은 화면: 전체 테이블 표시

---

## 🎯 재설계 방향

### 핵심 원칙

1. **리스팅 중심 레이아웃**
   - 기본 화면은 **테이블/카드 리스트**
   - 등록/편집은 **모달 또는 사이드바**로 분리

2. **일관된 CRUD 패턴**
   - **Create**: 우측 상단 "+ 추가" 버튼 → 모달
   - **Read**: 테이블/카드 뷰 (전체 너비 활용)
   - **Update**: 행 클릭 또는 "편집" 버튼 → 모달
   - **Delete**: 행의 삭제 버튼 + 확인 다이얼로그

3. **화면 공간 최적화**
   - 간단한 설정: 모달 (overlay로 화면 전체 차단)
   - 복잡한 관리: 테이블 전체 너비 + 모달 편집
   - 분석/인사이트: 전체 화면 활용

---

## 📐 새로운 레이아웃 구조

### 패턴 A: 리스팅 + 모달 패턴 (기본)

**적용 대상**: 인력 관리, 소모품 관리, 고정비 관리

```tsx
// 기본 화면 - 리스트 중심
<section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
  {/* 헤더 영역 */}
  <header className="mb-4 flex items-center justify-between">
    <div>
      <h2>인력 관리</h2>
      <p>의사, 간호사 등 역할별 급여와 근무 시간을 등록합니다.</p>
    </div>
    <button onClick={openCreateModal} className="bg-blue-600 text-white">
      + 인력 추가
    </button>
  </header>

  {/* 요약 정보 (선택적) */}
  <div className="mb-4 grid gap-3 sm:grid-cols-3">
    <div className="bg-gray-50 p-3 rounded">
      <p className="text-xs text-gray-600">총 인력</p>
      <p className="text-lg font-semibold">{staff.length}명</p>
    </div>
    {/* 기타 통계 */}
  </div>

  {/* 테이블 - 전체 너비 활용 */}
  <div className="overflow-x-auto">
    <table className="min-w-full">
      <thead>
        <tr>
          <th>이름</th>
          <th>역할</th>
          <th>월 급여</th>
          <th>분당 인건비</th>
          <th></th> {/* 액션 컬럼 */}
        </tr>
      </thead>
      <tbody>
        {staff.map(item => (
          <tr key={item.id}>
            <td>{item.name}</td>
            <td>{item.role}</td>
            <td>{formatKrw(item.monthlySalary)}</td>
            <td>{formatKrw(item.minuteRate)}</td>
            <td>
              <button onClick={() => openEditModal(item)}>편집</button>
              <button onClick={() => handleDelete(item.id)}>삭제</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</section>

{/* 모달 - 등록/편집 */}
<Modal isOpen={isModalOpen} onClose={closeModal}>
  <ModalHeader>
    <h3>{isEditing ? '인력 수정' : '새 인력 추가'}</h3>
  </ModalHeader>
  <ModalBody>
    <form className="grid gap-4 md:grid-cols-2">
      {/* 입력 필드들 */}
    </form>
  </ModalBody>
  <ModalFooter>
    <button onClick={closeModal}>취소</button>
    <button onClick={handleSubmit}>{isEditing ? '수정' : '추가'}</button>
  </ModalFooter>
</Modal>
```

**장점**:
- 리스트가 주인공, 전체 화면 활용
- 등록/편집은 임시 overlay로 분리
- 저장 후 즉시 리스트에 반영 (Optimistic UI)
- 시각적 일관성 확보

### 패턴 B: 초기 설정 모달 패턴

**적용 대상**: 운영 설정 (최초 1회 설정)

```tsx
// 운영 설정 섹션
<section className="rounded-lg border border-gray-200 bg-white p-6">
  <header className="mb-4 flex items-center justify-between">
    <div>
      <h2>운영 세팅</h2>
      <p>월 가용 시간을 정의합니다.</p>
    </div>
    <button onClick={openSettingsModal}>⚙️ 수정</button>
  </header>

  {/* 현재 설정 요약 */}
  <div className="grid gap-3 sm:grid-cols-2 max-w-2xl">
    <div className="bg-blue-50 border border-blue-100 p-4 rounded">
      <p className="text-sm text-blue-800">월 영업일수</p>
      <p className="text-2xl font-bold text-blue-900">
        {operational.operatingDays || '-'}일
      </p>
    </div>
    <div className="bg-blue-50 border border-blue-100 p-4 rounded">
      <p className="text-sm text-blue-800">일 영업시간</p>
      <p className="text-2xl font-bold text-blue-900">
        {operational.operatingHoursPerDay || '-'}시간
      </p>
    </div>
  </div>

  {/* 계산 결과 */}
  <div className="mt-4 bg-green-50 border border-green-200 p-4 rounded">
    <p className="text-sm text-green-800">월 가용 시간</p>
    <p className="text-xl font-bold text-green-900">
      {capacityMinutes.toLocaleString()}분
    </p>
  </div>
</section>

{/* 설정 모달 */}
<Modal isOpen={isSettingsModalOpen}>
  <form onSubmit={handleSaveSettings}>
    {/* 간단한 2개 필드 */}
  </form>
</Modal>
```

**장점**:
- 설정 후에는 요약만 표시 (화면 공간 절약)
- 필요 시에만 모달로 수정
- 계산 결과를 시각적으로 강조

### 패턴 C: 복잡한 등록 - 다단계 모달

**적용 대상**: 시술 관리

```tsx
// 시술 관리 - 리스트 화면
<section>
  <header className="flex justify-between">
    <h2>시술 관리</h2>
    <button onClick={openProcedureWizard}>+ 시술 추가</button>
  </header>

  <table className="min-w-full">
    {/* 시술 리스트 */}
  </table>
</section>

// 다단계 모달
<WizardModal isOpen={isWizardOpen} currentStep={step}>
  {/* Step 1: 기본 정보 */}
  {step === 1 && (
    <div>
      <h3>시술 기본 정보</h3>
      <input name="name" placeholder="시술명" />
      <input name="price" placeholder="판매가" />
      <input name="treatmentMinutes" placeholder="시술 시간" />
      <button onClick={() => setStep(2)}>다음: 투입 인력 선택</button>
    </div>
  )}

  {/* Step 2: 인력 선택 */}
  {step === 2 && (
    <div>
      <h3>투입 인력 선택</h3>
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
            />
          )}
        </label>
      ))}
      <button onClick={() => setStep(1)}>이전</button>
      <button onClick={() => setStep(3)}>다음: 소모품 선택</button>
    </div>
  )}

  {/* Step 3: 소모품 선택 */}
  {step === 3 && (
    <div>
      <h3>소모품 선택</h3>
      {/* 동일한 체크박스 + 수량 패턴 */}
      <button onClick={() => setStep(2)}>이전</button>
      <button onClick={handleSubmit}>최종 저장</button>
    </div>
  )}
</WizardModal>
```

**장점**:
- 복잡한 폼을 단계별로 분리
- 각 단계에 집중 가능
- 진행 상황 시각화 (1/3, 2/3, 3/3)
- 이전 버튼으로 수정 가능

### 패턴 D: 분석/인사이트 - 전체 화면 활용

**적용 대상**: 시술 카탈로그, 결과 대시보드, 마케팅 인사이트

```tsx
<section className="rounded-lg border border-gray-200 bg-white p-6">
  <h2>시술 카탈로그</h2>

  {/* 필터/검색 */}
  <div className="mb-4 flex gap-3">
    <input type="search" placeholder="시술명 검색..." className="flex-1" />
    <select>
      <option>전체 마진율</option>
      <option>높은 마진율 (40% 이상)</option>
      <option>낮은 마진율 (30% 미만)</option>
    </select>
  </div>

  {/* 카드 그리드 - 전체 너비 활용 */}
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    {procedures.map(proc => (
      <ProcedureCard key={proc.id} procedure={proc} />
    ))}
  </div>
</section>
```

**장점**:
- 전체 화면을 카드 그리드로 활용
- 한눈에 여러 항목 비교
- 반응형 레이아웃 (화면 크기에 따라 컬럼 수 조정)

---

## 🚀 구현 로드맵

### Phase 1: 공통 모달 컴포넌트 작성 (우선순위: 최고)

**작업 내용**:
```tsx
// components/common/Modal.tsx
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, size = 'md' }) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-gray-900 bg-opacity-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={`relative bg-white rounded-lg shadow-xl ${sizeClasses[size]} w-full mx-4`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 max-h-[calc(100vh-200px)] overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
```

**예상 소요**: 2시간

**⚠️ Phase 1 완료 시 필수 검증**:
```bash
# 계산 정합성 테스트 실행 (5/5 PASS 필수)
npx tsx src/services/standaloneCosting/__test__/run-verification.ts
```

### Phase 2: 운영 설정 → 요약 뷰 + 모달 (우선순위: 높음)

**작업 내용**:
1. `OperationalSettingsSection` 리팩토링
2. 기본 화면: 현재 설정 요약 카드 표시
3. "수정" 버튼 클릭 → 모달 열림
4. 모달 내부: 기존 폼 이동
5. 저장 → 모달 닫힘 + 요약 업데이트

**예상 소요**: 3시간

**⚠️ Phase 2 완료 시 필수 검증**:
```bash
# 운영 설정 변경 후 월 가용 시간 계산 정상 작동 확인 (CRITICAL)
npx tsx src/services/standaloneCosting/__test__/run-verification.ts
# 특히 Test 1 (월 가용 시간 계산) PASS 필수
```

### Phase 3: 인력/소모품/고정비 → 리스팅 + 모달 패턴 (우선순위: 높음)

**작업 내용**:
1. 각 섹션에서 폼 제거, 테이블만 표시
2. 우측 상단에 "+ 추가" 버튼 배치
3. 모달 상태 관리 추가
4. 모달 내부로 폼 이동
5. "편집" 버튼 → 모달 열기 + 기존 데이터 로드
6. Optimistic UI 적용 (저장 즉시 테이블 업데이트)

**파일 수정**:
- `StaffManagementSection.tsx`
- `MaterialManagementSection.tsx`
- `FixedCostManagementSection.tsx`

**예상 소요**: 6시간 (각 2시간)

**⚠️ Phase 3 완료 시 필수 검증**:
```bash
# 인력/소모품/고정비 저장 후 계산 정상 작동 확인 (CRITICAL)
npx tsx src/services/standaloneCosting/__test__/run-verification.ts
# Test 2 (인력 분당 단가), Test 3 (소모품 단위당 원가), Test 5 (고정비 합계) PASS 필수
```

### Phase 4: 시술 관리 → 다단계 모달 (우선순위: 중간)

**작업 내용**:
1. `WizardModal` 컴포넌트 작성
2. Step 상태 관리 (`useState<1 | 2 | 3>`)
3. Step 1: 기본 정보 입력
4. Step 2: 인력 선택 (체크박스 + 인라인 수량)
5. Step 3: 소모품 선택 (체크박스 + 인라인 수량)
6. 진행 표시기 추가 (Step 1/3, 2/3, 3/3)
7. 이전/다음 버튼으로 단계 이동

**예상 소요**: 8시간

**⚠️ Phase 4 완료 시 필수 검증**:
```bash
# 시술 등록/편집 후 종합 원가 계산 정상 작동 확인 (CRITICAL)
npx tsx src/services/standaloneCosting/__test__/run-verification.ts
# Test 4 (종합 시술 원가 계산) PASS 필수 - 가장 복잡한 계산
```

### Phase 5: 시술 카탈로그 → 전체 화면 카드 그리드 (우선순위: 낮음)

**작업 내용**:
1. `ProcedureCatalogSection` 레이아웃 조정
2. 카드 그리드로 변경 (현재 테이블 → 카드 뷰)
3. 반응형 컬럼 수 조정 (sm:2, lg:3, xl:4)
4. 필터/검색 UI 개선

**예상 소요**: 3시간

**⚠️ Phase 5 완료 시 필수 검증**:
```bash
# 카탈로그 레이아웃 변경 후 데이터 표시 정상 확인
npx tsx src/services/standaloneCosting/__test__/run-verification.ts
```

### Phase 6: 전체 계산 정합성 최종 검증 (필수)

**⚠️ CRITICAL - 모든 Phase 완료 후 최종 검증**

**작업 내용**:
1. 전체 계산 테스트 실행
2. 모든 섹션에서 데이터 입력 → 저장 → 계산 결과 확인
3. 엣지 케이스 테스트 (0원, 음수 입력 방지 등)
4. 실제 사용자 시나리오 테스트

**검증 명령어**:
```bash
# 5/5 테스트 모두 PASS 필수
npx tsx src/services/standaloneCosting/__test__/run-verification.ts
```

**통과 기준**:
```
============================================================
계산 정합성 검증 테스트 시작
============================================================

✓ Test 1: 월 가용 시간 계산 - ✅ PASS
✓ Test 2: 인력 분당 단가 계산 - ✅ PASS
✓ Test 3: 소모품 단위당 원가 계산 - ✅ PASS
✓ Test 4: 종합 시술 원가 계산 - ✅ PASS
✓ Test 5: 고정비 그룹별 합계 - ✅ PASS

============================================================
테스트 결과 요약
============================================================
총 5개 테스트 중 5개 성공
결과: ✅ 모든 테스트 통과
============================================================
```

**❌ 하나라도 실패 시**:
- 즉시 해당 Phase로 롤백
- 원인 파악 및 수정
- 재검증 후 다음 단계 진행

**예상 소요**: 30분 (테스트 + 수동 검증)

---

## ✅ 검증 체크리스트

### 레이아웃 일관성
- [ ] 모든 섹션이 동일한 CRUD 패턴 사용
- [ ] 리스트 화면에서 폼이 보이지 않음
- [ ] 모달 크기가 콘텐츠에 적절함
- [ ] 테이블이 전체 너비를 효율적으로 활용

### UX 개선
- [ ] 등록/편집 흐름이 명확함
- [ ] 모달 열기/닫기가 부드러움
- [ ] Escape 키로 모달 닫기 가능
- [ ] Overlay 클릭 시 모달 닫기 동작 (선택적)
- [ ] 폼 유효성 검증 메시지 표시

### 계산 정합성 (최우선)
- [ ] 5/5 테스트 모두 통과
- [ ] 모달 저장 시 계산 로직 정상 작동
- [ ] 편집 후 테이블 데이터 즉시 반영

### 접근성
- [ ] 모달 열릴 때 포커스 이동
- [ ] Tab 키로 모달 내 요소 이동
- [ ] 스크린 리더 지원 (aria-label, role)

---

## 📊 예상 개발 시간

| Phase | 작업 내용 | 소요 시간 | 검증 시간 |
|-------|----------|----------|-----------|
| Phase 1 | 공통 모달 컴포넌트 | 2시간 | +10분 (계산 테스트) |
| Phase 2 | 운영 설정 리팩토링 | 3시간 | +10분 (계산 테스트) |
| Phase 3 | 인력/소모품/고정비 패턴 적용 | 6시간 | +10분 (계산 테스트) |
| Phase 4 | 시술 관리 다단계 모달 | 8시간 | +15분 (계산 테스트) |
| Phase 5 | 시술 카탈로그 개선 | 3시간 | +10분 (계산 테스트) |
| Phase 6 | **전체 계산 정합성 최종 검증** | **0.5시간** | **중간 검증 포함** |
| **총계** | | **22.5시간** | **+1시간 (검증)** |
| **실제 총계** | | **23.5시간** | |

**실제 예상 기간**: 3일 작업 (하루 7-8시간 기준)

**⚠️ 중요**: 각 Phase마다 계산 정합성 검증에 10-15분 소요. 테스트 실패 시 디버깅 시간 추가 필요.

---

## 🎨 디자인 시스템 (모달 전용)

### 모달 크기 기준

```typescript
const MODAL_SIZES = {
  sm: 'max-w-md',    // 간단한 확인/설정 (운영 설정)
  md: 'max-w-2xl',   // 일반 폼 (인력, 소모품, 고정비)
  lg: 'max-w-4xl',   // 복잡한 폼 (시술 등록 Step 2, 3)
  xl: 'max-w-6xl',   // 전체 화면에 가까운 모달 (선택적)
};
```

### 모달 애니메이션 (선택적)

```tsx
// Framer Motion 사용 시
<motion.div
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
  exit={{ opacity: 0, scale: 0.95 }}
  transition={{ duration: 0.2 }}
>
  {/* Modal content */}
</motion.div>
```

### 버튼 스타일 일관성

```tsx
// Primary action (저장, 추가)
<button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
  저장
</button>

// Secondary action (취소)
<button className="border border-gray-300 text-gray-700 hover:bg-gray-100 px-4 py-2 rounded">
  취소
</button>

// Danger action (삭제)
<button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded">
  삭제
</button>
```

---

## 🔄 마이그레이션 전략

### 단계별 전환 (Breaking Changes 최소화)

**⚠️ CRITICAL**: 각 Phase는 독립적으로 완료하며, 반드시 계산 정합성 검증 후 다음 단계 진행

1. **Phase 1 완료 후**:
   - 모달 컴포넌트만 추가 (기존 코드 영향 없음)
   - ✅ **계산 테스트 5/5 PASS 확인**
   - Git commit: `feat: add common Modal component`

2. **Phase 2 완료 후**:
   - 운영 설정만 새 패턴 적용
   - ✅ **Test 1 (월 가용 시간) PASS 확인** (CRITICAL)
   - Git commit: `refactor: operational settings to summary + modal`

3. **Phase 3 완료 후**:
   - 나머지 관리 섹션도 순차 적용
   - ✅ **Test 2, 3, 5 (인력/소모품/고정비) PASS 확인**
   - 각 섹션별 commit 분리:
     - `refactor: staff management to listing + modal`
     - `refactor: material management to listing + modal`
     - `refactor: fixed cost management to listing + modal`

4. **Phase 4 완료 후**:
   - 시술 관리 다단계 모달 적용
   - ✅ **Test 4 (종합 시술 원가) PASS 확인** (가장 복잡 - CRITICAL)
   - Git commit: `feat: add wizard modal for procedure management`

5. **Phase 5 완료 후**:
   - 시술 카탈로그 레이아웃 개선
   - ✅ **전체 테스트 5/5 PASS 확인**
   - Git commit: `refactor: procedure catalog to card grid`

6. **Phase 6 완료 후**:
   - 전체 최종 검증
   - ✅ **모든 테스트 + 수동 시나리오 테스트**
   - Git commit: `test: verify all calculation integrity after layout redesign`

### Rollback 계획

**즉시 롤백 기준**:
- ❌ 계산 테스트 1개라도 FAIL
- ❌ 기존 기능 동작 안 함
- ❌ 데이터 저장 실패

**롤백 절차**:
1. 실패한 Phase의 마지막 commit으로 revert
2. 원인 파악 및 수정
3. 계산 테스트 재확인
4. 통과 후 재진행

**Git 브랜치 전략**:
- `main` - 안정 버전
- `feature/layout-redesign` - 전체 작업 브랜치
- `feature/layout-redesign-phase-N` - 각 Phase별 브랜치 (선택적)

---

## 📝 참고 문서

- **UX 리서치**:
  - Modal UX Design Patterns (LogRocket)
  - Data Table Design Best Practices (Pencil & Paper)
  - Shopify Admin UI Extensions

- **기존 문서**:
  - `/docs/costing-ux-improvement-plan.md` - 전체 UX 개선 방향
  - `/docs/prd/신규prd.md` - 계산 로직 명세
  - `/src/services/standaloneCosting/__test__/calculations.verification.ts` - 계산 검증 테스트

---

## 🚦 다음 단계

### Phase별 실행 체크리스트

**현재 단계**: ✅ Plan 검토 및 승인

**다음 진행 순서**:

1. **Phase 1 시작**: 공통 모달 컴포넌트 작성
   - [ ] Modal.tsx 컴포넌트 구현
   - [ ] ⚠️ **계산 테스트 5/5 PASS 확인**
   - [ ] Git commit 및 push

2. **Phase 2 시작**: 운영 설정 리팩토링
   - [ ] 요약 뷰 UI 작성
   - [ ] 모달로 폼 이동
   - [ ] ⚠️ **Test 1 (월 가용 시간) PASS 확인 (CRITICAL)**
   - [ ] Git commit 및 push

3. **Phase 3 시작**: 인력/소모품/고정비 패턴 적용
   - [ ] StaffManagementSection 리팩토링
   - [ ] MaterialManagementSection 리팩토링
   - [ ] FixedCostManagementSection 리팩토링
   - [ ] ⚠️ **Test 2, 3, 5 PASS 확인**
   - [ ] Git commit 및 push (각 섹션별)

4. **Phase 4 시작**: 시술 관리 다단계 모달
   - [ ] WizardModal 컴포넌트 구현
   - [ ] 3단계 폼 구현
   - [ ] ⚠️ **Test 4 (종합 원가) PASS 확인 (CRITICAL)**
   - [ ] Git commit 및 push

5. **Phase 5 시작**: 시술 카탈로그 개선
   - [ ] 카드 그리드 레이아웃 구현
   - [ ] 필터/검색 UI 개선
   - [ ] ⚠️ **전체 테스트 5/5 PASS 확인**
   - [ ] Git commit 및 push

6. **Phase 6: 전체 계산 정합성 최종 검증**
   - [ ] ⚠️ **5/5 테스트 PASS 확인 (필수)**
   - [ ] 수동 시나리오 테스트
   - [ ] 엣지 케이스 테스트
   - [ ] 사용자 테스트 및 피드백 수집
   - [ ] Git commit 및 push

---

**⚠️ 시작 전 필수 확인사항**:
- [ ] 현재 코드에서 계산 테스트 5/5 PASS 확인
- [ ] Git 작업 브랜치 생성 (`feature/layout-redesign`)
- [ ] 백업 commit 생성
- [ ] Plan 문서 최종 승인

**🚀 시작 가능 여부 확인 후 Phase 1 구현 착수**
