# 시술 원가 계산 모듈 - 이커머스 스타일 전면 개편 완벽 구현 명세

> **작성일**: 2025-10-03
> **대상 모듈**: `/costing` (Standalone Costing Module)
> **개편 방향**: 전면 개편 - 이커머스 카탈로그 스타일 UX
> **핵심 원칙**: 계산 정합성 유지, 기존 디자인 시스템 준수, Emoji 배제

---

## 목차

### 1부: 개요 및 계산 로직
- [1. 프로젝트 개요](#1-프로젝트-개요)
- [2. 핵심 계산 로직](#2-핵심-계산-로직)
- [3. 데이터 의존성 및 흐름](#3-데이터-의존성-및-흐름)

### 2부: UX 흐름 및 화면 설계
- [4. 전체 UX 흐름](#4-전체-ux-흐름)
- [5. 화면별 상세 설계](#5-화면별-상세-설계)

### 3부: 컴포넌트 상세 명세
- [6. 컴포넌트 구조](#6-컴포넌트-구조)
- [7. 각 컴포넌트 상세 명세](#7-각-컴포넌트-상세-명세)

### 4부: 구현 가이드
- [8. 디자인 시스템 준수 사항](#8-디자인-시스템-준수-사항)
- [9. 상태 관리 및 데이터 흐름](#9-상태-관리-및-데이터-흐름)
- [10. 에러 처리 및 검증](#10-에러-처리-및-검증)
- [11. 구현 순서 및 체크리스트](#11-구현-순서-및-체크리스트)

---

## 1부: 개요 및 계산 로직

---

## 1. 프로젝트 개요

### 1.1 목적
의료 시술의 원가를 정확히 계산하고, 마진율과 손익분기점을 실시간으로 확인할 수 있는 도구를 제공합니다. 이커머스 상품 카탈로그처럼 직관적인 UX로 재설계하여 사용자가 시술을 "상품"으로, 인력/소모품을 "옵션"으로 쉽게 이해하고 관리할 수 있도록 합니다.

### 1.2 현재 상태 분석

**현재 구조 (6개 탭)**:
1. 운영 세팅 (OperationalSettingsSection)
2. 인력 관리 (StaffManagementSection)
3. 소모품 관리 (MaterialManagementSection)
4. 고정비 관리 (FixedCostManagementSection)
5. 시술·결과 (ProcedureManagementSection + ProcedureResultsSection)
6. 마케팅 인사이트 (MarketingInsightsSection) - 준비 중

**문제점**:
- 시술 등록 UI가 폼 중심으로 직관성 부족
- 결과 확인이 테이블 중심으로 시각적 피드백 약함
- 고정비 3그룹(facility/common/marketing) 구분이 사용자에게 명확하지 않음
- 운영 세팅이 0일 때 경고가 약함
- 시술 시간(treatmentMinutes vs totalMinutes) 구분 설명 부족

### 1.3 개편 목표

**핵심 개선 사항**:
1. **이커머스 카탈로그 UX**: 시술을 카드 그리드로 표시, 상품 카탈로그처럼 직관적 탐색
2. **실시간 시각적 피드백 강화**: 마진율 상태 배지, 프로그레스 바, 차트 추가
3. **고정비 그룹 명확화**: 각 그룹의 역할과 계산 반영 여부를 UI에 명시
4. **운영 세팅 경고 강화**: 0일 때 명확한 경고 메시지와 UI 블로킹
5. **계산 정합성 100% 유지**: 기존 calculations.ts 로직 완전 보존

**디자인 원칙**:
- ✅ 기존 Tailwind 패턴 준수 (색상, 간격, 크기)
- ✅ Emoji 완전 배제 → 텍스트, 배지, 아이콘 컴포넌트 사용
- ✅ 기존 컴포넌트 재사용 (Table, Modal, NotificationModal)
- ✅ 점진적 확장 (카드 뷰는 기존 패턴의 자연스러운 확장)

---

## 2. 핵심 계산 로직

### 2.1 계산 공식 전체 (calculations.ts 기준)

#### 2.1.1 월 가용 시간 계산
```typescript
// calculateOperationalMinutes(config: OperationalConfig): number
월 가용시간(분) = 월 영업일수 × 1일 영업시간 × 60분

예시:
- 월 영업일수: 26일
- 1일 영업시간: 10시간
→ 26 × 10 × 60 = 15,600분
```

**중요**:
- `operatingDays` 또는 `operatingHoursPerDay`가 null/0이면 0 반환
- 이 값이 0이면 고정비 배분이 불가능하므로 **운영 세팅은 필수 선행**

#### 2.1.2 인력 분당 단가 계산
```typescript
// calculateStaffMinuteRate(staff: StaffProfile): number
인력 분당 단가 = 월급 / (근무일수 × 근무시간 × 60분)

예시:
- 의사: 8,000,000원 / (22일 × 8시간 × 60분) = 757.58원/분
- 간호사: 3,500,000원 / (22일 × 8시간 × 60분) = 330.69원/분
```

**StaffProfile 구조**:
```typescript
interface StaffProfile {
  id: string;
  name: string;
  role: string;              // 직무 (예: 의사, 간호사)
  monthlySalary: number;     // 월급
  workDaysPerMonth: number;  // 월 근무일수
  workHoursPerDay: number;   // 일 근무시간
  notes?: string;
}
```

#### 2.1.3 소모품 단위 단가 계산
```typescript
// calculateMaterialUnitCost(material: MaterialItem): number
소모품 단위 단가 = 단가 / 수량

예시:
- 울쎄라 팁: 204,000원 / 2,400 shots = 85원/shot
- 마취 크림: 15,000원 / 1개 = 15,000원/개
```

**MaterialItem 구조**:
```typescript
interface MaterialItem {
  id: string;
  name: string;
  unitLabel: string;    // 단위 (예: shot, cc, vial, 개)
  unitQuantity: number; // 단위당 수량
  unitPrice: number;    // 단가
  notes?: string;
}
```

#### 2.1.4 고정비 분당 배분율 계산 (facility 그룹만)
```typescript
// calculateFixedCostPerMinute(fixedCosts: FixedCostItem[], operationalMinutes: number): number
고정비 분당 = 월 시설·운영비 / 월 가용시간

예시:
- 월 시설·운영비(facility): 5,000,000원
- 월 가용시간: 15,600분
→ 5,000,000 / 15,600 = 320.51원/분
```

**중요**:
- **facility 그룹만** 시술별 배분됨
- common, marketing 그룹은 배분 안 됨 (별도 손익 검토)

**FixedCostItem 구조**:
```typescript
interface FixedCostItem {
  id: string;
  name: string;
  monthlyAmount: number;
  costGroup: 'facility' | 'common' | 'marketing';
  notes?: string;
}
```

#### 2.1.5 시술별 원가 계산
```typescript
// buildProcedureBreakdown(procedure: ProcedureFormValues, context): ProcedureCostBreakdown

// 1. 직접 인건비
직접 인건비 = Σ(인력 분당 단가 × 투입 시간)

예시:
- 의사 30분: 757.58 × 30 = 22,727원
- 간호사 15분: 330.69 × 15 = 4,960원
→ 총 직접 인건비: 27,687원

// 2. 소모품 비용
소모품 비용 = Σ(소모품 단위 단가 × 사용량)

예시:
- 울쎄라 팁 300 shots: 85 × 300 = 25,500원
- 마취 크림 1개: 15,000 × 1 = 15,000원
→ 총 소모품 비용: 40,500원

// 3. 고정비 배분 (totalMinutes 기준)
고정비 배분 = 고정비 분당 × 총 체류시간

예시:
- 고정비 분당: 320.51원/분
- 총 체류시간: 45분
→ 320.51 × 45 = 14,423원

// 4. 총 원가
총 원가 = 직접 인건비 + 소모품 비용 + 고정비 배분
→ 27,687 + 40,500 + 14,423 = 82,610원
```

**중요**:
- `treatmentMinutes`: 순수 시술 시간 (마진 분석용)
- `totalMinutes`: 총 체류시간 (상담+준비+시술+정리, **고정비 배분 기준**)

#### 2.1.6 마진 계산
```typescript
// 마진
마진 = 판매가 - 총 원가

// 마진율
마진율 = (마진 / 판매가) × 100

예시:
- 판매가: 1,200,000원
- 총 원가: 82,610원
→ 마진: 1,117,390원
→ 마진율: 93.12%
```

#### 2.1.7 손익분기 계산
```typescript
// calculateBreakevenUnits(price, directCost, monthlyFacilityFixed): number | null

// 1. 직접비용
직접비용 = 직접 인건비 + 소모품 비용

// 2. 기여이익
기여이익 = 판매가 - 직접비용

// 3. 손익분기 건수
손익분기 건수 = 월 시설·운영비 / 기여이익

예시:
- 판매가: 1,200,000원
- 직접비용: 68,187원
→ 기여이익: 1,131,813원
- 월 시설·운영비: 5,000,000원
→ 손익분기: 5,000,000 / 1,131,813 = 4.4건 → 올림 5건
```

**중요**:
- 기여이익 ≤ 0 이면 손익분기 계산 불가 (null 반환)

### 2.2 계산 로직 검증 결과

| 계산 항목 | 상태 | 검증 내용 |
|---------|------|----------|
| 월 가용시간 | ✅ 완벽 | operatingDays × operatingHours × 60 |
| 인력 분당 단가 | ✅ 완벽 | 월급 / (근무일수 × 근무시간 × 60) |
| 소모품 단가 | ✅ 완벽 | 단가 / 수량 |
| 고정비 3그룹 구분 | ✅ 완벽 | facility/common/marketing |
| 고정비 배분 | ✅ 완벽 | facility만 시술별 배분, common/marketing 제외 |
| 시술 원가 계산 | ✅ 완벽 | 직접비 + 소모품 + 고정비 배분 |
| 마진 계산 | ✅ 완벽 | 판매가 - 총 원가 |
| 손익분기 계산 | ✅ 완벽 | 월 시설비 / 기여이익 |
| totalMinutes 사용 | ✅ 완벽 | 고정비 배분에 totalMinutes 사용 (올바름) |

---

## 3. 데이터 의존성 및 흐름

### 3.1 데이터 의존성 다이어그램

```
┌──────────────────────────────────────────────────┐
│  1. 운영 세팅 (필수 선행) ⭐⭐⭐                    │
│  ├─ 월 영업일수: operatingDays                   │
│  ├─ 1일 영업시간: operatingHoursPerDay           │
│  └─ 계산: 월 가용시간(분) = 26 × 10 × 60         │
│      → 15,600분                                  │
└──────────────────────────────────────────────────┘
                    ↓
         (이 값이 0이면 고정비 배분 = 0)
                    ↓
┌──────────────────────────────────────────────────┐
│  2. 고정비 설정 (3그룹)                           │
│  ├─ facility: 5,000,000원 → 시술별 배분 ✅       │
│  ├─ common: 2,000,000원 → 배분 안 함            │
│  └─ marketing: 3,000,000원 → 배분 안 함         │
│                                                  │
│  계산: 고정비 분당 = 5,000,000 / 15,600          │
│        → 320.51원/분                             │
└──────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│  3. 인력 설정                                     │
│  ├─ 의사: 8,000,000원 / (22일×8h×60분)          │
│  │   → 757.58원/분                              │
│  └─ 간호사: 3,500,000원 / (22일×8h×60분)        │
│      → 330.69원/분                              │
└──────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│  4. 소모품 설정                                   │
│  ├─ 울쎄라 팁: 204,000원 / 2400 shots           │
│  │   → 85원/shot                                │
│  └─ 마취 크림: 15,000원 / 1개                    │
│      → 15,000원/개                              │
└──────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│  5. 시술 등록 (모든 요소 통합)                    │
│                                                  │
│  울쎄라 리프팅 (판매가 1,200,000원)               │
│  ├─ 직접 인건비:                                 │
│  │   (757.58×30분) + (330.69×15분) = 27,588원  │
│  ├─ 소모품 비용:                                 │
│  │   (85×300) + 15,000 = 40,500원               │
│  ├─ 고정비 배분:                                 │
│  │   320.51 × 45분 = 14,423원                   │
│  ├─ 총 원가: 82,511원                            │
│  ├─ 마진: 1,117,489원                           │
│  ├─ 마진율: 93.1%                                │
│  └─ 손익분기: 5,000,000 / 1,131,912 = 4.4건     │
└──────────────────────────────────────────────────┘
```

### 3.2 Prerequisite 체크 로직

현재 구현된 prerequisite 체크 (StandaloneCostingPage.tsx:95-103):

```typescript
// 탭 이동 시 이전 단계 완료 여부 체크
const handleTabSelect = (nextTabId: string) => {
  const nextIndex = tabs.findIndex(tab => tab.id === nextTabId);

  if (nextIndex > 0) {
    for (let i = 0; i < nextIndex; i += 1) {
      const prerequisite = tabs[i];
      if (prerequisite.completion && !prerequisite.completion()) {
        setModalMessage(prerequisite.incompleteMessage ?? '이전 단계를 먼저 완료하세요.');
        setActiveTab(prerequisite.id);
        return;
      }
    }
  }
  setActiveTab(nextTabId);
};
```

**각 탭의 completion 조건**:

| 탭 | completion 조건 | 메시지 |
|----|----------------|--------|
| 운영 세팅 | `operatingDays !== null && operatingHoursPerDay !== null` | "운영 세팅을 먼저 저장하세요." |
| 인력 관리 | `staff.length > 0` | "최소 1명의 인력을 등록하세요." |
| 소모품 관리 | `materials.length > 0` | "최소 1개의 소모품을 등록하세요." |
| 고정비 관리 | `fixedCosts.length > 0` | "최소 1개의 고정비를 등록하세요." |
| 시술·결과 | 없음 | - |
| 마케팅 인사이트 | `procedures.length > 0` | "시술 데이터를 먼저 등록하면 마케팅 인사이트 분석을 준비할 수 있습니다." |

### 3.3 상태 관리 (StandaloneCostingProvider)

**전역 상태 구조**:
```typescript
interface StandaloneCostingState {
  operational: OperationalConfig;
  equipment: EquipmentProfile[];        // 준비 중, 계산 미반영
  useEquipmentHierarchy: boolean;       // 준비 중
  staff: StaffProfile[];
  materials: MaterialItem[];
  fixedCosts: FixedCostItem[];
  procedures: ProcedureFormValues[];
  breakdowns: ProcedureCostBreakdown[]; // 자동 계산됨
  lastSavedAt: string | null;
}
```

**자동 재계산 트리거**:
- `setOperationalConfig` → breakdowns 재계산
- `upsertStaff`, `removeStaff` → breakdowns 재계산
- `upsertMaterial`, `removeMaterial` → breakdowns 재계산
- `upsertFixedCost`, `removeFixedCost` → breakdowns 재계산
- `upsertProcedure`, `removeProcedure` → breakdowns 재계산

**자동 저장**:
```typescript
// StandaloneCostingProvider.tsx:223-233
useEffect(() => {
  if (!hydratedRef.current) {
    return;
  }
  const persist = async () => {
    await saveDraft(state);
  };
  persist().catch(error => {
    console.error('[StandaloneCosting] Failed to persist state', error);
  });
}, [state]);
```

→ state 변경 시 자동으로 `/api/standalone-costing` API에 저장

---

(다음 섹션은 2부 문서에서 계속)
