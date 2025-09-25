# 원가 계산 모듈 리팩토링 PRD

## 📋 프로젝트 개요

### 목적
현재 복잡한 기준월 기반 원가 계산 시스템을 단순하고 실용적인 스탠드얼론 원가 계산기로 리팩토링하여 사용성과 구현 효율성을 극대화합니다.

### 배경
- 현재 코스팅 모듈은 기준월-손익계산서 연동으로 인한 복잡성으로 사용자 진입 장벽이 높음
- 실제 의료기관에서는 간단한 원가 계산 도구가 복잡한 ERP식 시스템보다 더 유용함
- 기존 구현에서 데이터 무결성 문제와 기술 부채가 다수 발견됨

### 목표
- **구현 복잡도 50% 감소**: 기준월 컨텍스트 제거
- **사용자 접근성 향상**: 즉시 사용 가능한 계산기
- **실용성 극대화**: 가상 시나리오 분석 지원

---

## 🎯 비즈니스 요구사항

### 주요 사용자 시나리오

#### 1차 시나리오: 새 시술 도입 검토
```
사용자: "신규 레이저 시술을 도입하려고 하는데, 원가가 얼마나 될까?"
동작: 인력비, 소모품비, 장비비를 입력하여 즉시 원가 계산
```

#### 2차 시나리오: 가격 정책 최적화
```
사용자: "현재 시술 가격이 적정한지 확인하고 싶다"
동작: 현재 원가 구조를 입력하여 마진율 분석
```

#### 3차 시나리오: 비용 구조 변경 영향 분석
```
사용자: "인건비가 10% 오르면 수익성이 어떻게 변할까?"
동작: 시나리오별 원가 계산 및 비교 분석
```

### 성공 지표
- **사용 편의성**: 첫 계산까지 3분 이내
- **정확성**: 수동 계산 대비 ±2% 이내 오차
- **활용도**: 월 1회 이상 사용률 80%

---

## 🏗️ 기술 요구사항

### 아키텍처 변경

#### 기존 구조 (제거 대상)
```
FinancialDataContext → CostingBaselineContext → CostingServices
                  ↓
    복잡한 월별 데이터 동기화 로직
```

#### 신규 구조 (목표)
```
CostingCalculatorContext → CostingServices
                      ↓
        단순한 입력→계산→결과 파이프라인
```

### 데이터 모델

#### 핵심 엔티티
```typescript
interface CostingSession {
  id: string;
  name: string;                    // "2024년 신규시술 분석"
  description?: string;
  createdAt: string;
  updatedAt: string;

  // 원가 구성요소
  staff: StaffCostInput[];
  consumables: ConsumableCostInput[];
  fixedCosts: FixedCostInput[];
  procedures: ProcedureDefinition[];
}

interface StaffCostInput {
  id: string;
  role: string;                    // "의사", "간호사", "원장"
  hourlyCost: number;             // 시간당 비용
  description?: string;
}

interface ConsumableCostInput {
  id: string;
  name: string;                   // "주사기", "소독제"
  unitCost: number;              // 단위 비용
  unit: string;                  // "개", "ml", "회"
  description?: string;
}

interface FixedCostInput {
  id: string;
  name: string;                  // "장비 임대료", "전기료"
  monthlyAmount: number;         // 월 고정비
  source: 'manual' | 'template'; // 직접입력 vs /fixed-costs 연동
  templateId?: string;           // 연동된 템플릿 ID
  allocationMethod: 'time' | 'case' | 'manual'; // 배분 방식
  description?: string;
}

interface ProcedureDefinition {
  id: string;
  name: string;                  // "보톡스", "필러"
  variants: ProcedureVariant[];
}

interface ProcedureVariant {
  id: string;
  name: string;                  // "부분", "전체"
  salePrice: number;            // 판매가

  // 원가 구성
  staffRequirements: StaffRequirement[];
  consumableUsage: ConsumableUsage[];
  timeMinutes: number;          // 소요 시간
  fixedCostAllocation?: number; // 고정비 배분액
}
```

### 고정비 통합 전략

#### /fixed-costs 연동 구조
```typescript
interface FixedCostIntegration {
  // /fixed-costs에서 데이터 가져오기
  importFromTemplates(): Promise<FixedCostInput[]>;

  // 수동 입력 데이터와 병합
  mergeWithManualInputs(imported: FixedCostInput[], manual: FixedCostInput[]): FixedCostInput[];

  // 시술별 고정비 배분 계산
  allocateFixedCosts(fixedCosts: FixedCostInput[], procedure: ProcedureVariant): number;
}
```

---

## 📱 사용자 인터페이스 설계

### 메뉴 구조
```
/costing (기존 복잡한 하위 메뉴 제거)
├── 📊 새 분석 시작
├── 💾 저장된 분석 목록
└── ⚙️ 설정
```

### 화면 플로우

#### 1단계: 분석 세션 생성
```
┌─────────────────────────┐
│ 새 원가 분석            │
├─────────────────────────┤
│ 분석명: [            ] │
│ 설명: [              ] │
│                        │
│ [시작하기] [템플릿에서] │
└─────────────────────────┘
```

#### 2단계: 원가 요소 입력 (탭 구조)
```
┌─────────────────────────────────────┐
│ [인력비] [소모품비] [고정비] [시술] │
├─────────────────────────────────────┤
│                                     │
│ 인력비 설정                         │
│ ┌─────────────────────────────────┐ │
│ │ 역할      시간당비용    액션     │ │
│ │ 의사      100,000     [수정삭제] │ │
│ │ 간호사     30,000     [수정삭제] │ │
│ │                                 │ │
│ │ [+ 인력 추가]                   │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

#### 3단계: 시술 정의 및 계산
```
┌─────────────────────────────────────┐
│ 시술별 원가 계산 결과               │
├─────────────────────────────────────┤
│ 보톡스 (부분)                       │
│ ├ 판매가: 150,000원                │
│ ├ 인력비: 45,000원 (의사30분)       │
│ ├ 소모품비: 25,000원               │
│ ├ 고정비: 8,000원                  │
│ ├ 총원가: 78,000원                 │
│ ├ 마진: 72,000원 (48.0%)           │
│ └ [상세보기] [시나리오복사]         │
└─────────────────────────────────────┘
```

### 주요 UI 컴포넌트

#### 고정비 입력 컴포넌트
```typescript
interface FixedCostInputComponent {
  // /fixed-costs 연동 버튼
  importButton: {
    label: "기존 고정비에서 가져오기";
    action: () => void;
  };

  // 수동 입력 폼
  manualInput: {
    name: string;
    monthlyAmount: number;
    allocationMethod: 'time' | 'case' | 'manual';
  };

  // 배분 방식 설명
  allocationHelp: {
    time: "시술 시간에 비례하여 배분";
    case: "시술 건수에 균등 배분";
    manual: "직접 배분액 입력";
  };
}
```

---

## 🚀 구현 계획

### Phase 1: 핵심 기능 구현 (3일)

#### Day 1: 데이터 레이어 구축
- [ ] 새로운 타입 정의 (`CostingSession`, `StaffCostInput` 등)
- [ ] 로컬 스토리지 기반 세션 관리 서비스
- [ ] 기존 코스팅 모듈 의존성 분석 및 제거 계획 수립

#### Day 2: 기본 UI 구현
- [ ] 세션 생성/목록 화면
- [ ] 인력비/소모품비 입력 탭
- [ ] 기본 계산 엔진 구현

#### Day 3: 계산 및 결과 표시
- [ ] 시술별 원가 계산 로직
- [ ] 결과 화면 및 마진 분석
- [ ] 기본 유효성 검증

### Phase 2: 고정비 통합 (2일)

#### Day 4: /fixed-costs 연동
- [ ] 기존 고정비 템플릿 불러오기 API
- [ ] 고정비 선택 및 배분 방식 UI
- [ ] 고정비 포함 원가 계산

#### Day 5: 고급 기능
- [ ] 수동 고정비 입력
- [ ] 배분 방식별 계산 로직
- [ ] 고정비 미리보기 및 검증

### Phase 3: UX 개선 (2일)

#### Day 6: 데이터 관리
- [ ] 세션 저장/불러오기
- [ ] 템플릿 기능 (자주 사용하는 설정 저장)
- [ ] 데이터 내보내기 (CSV)

#### Day 7: 최종 완성
- [ ] 시나리오 복사 기능
- [ ] 도움말 및 가이드
- [ ] 성능 최적화 및 버그 수정

---

## 🔧 기술적 세부사항

### 제거될 컴포넌트들
```
❌ CostingBaselineContext
❌ CostingLayout (기준월 의존성)
❌ CostingBasePage (기준월 관리)
❌ CostingProceduresPage (복잡한 기준월 연동)
❌ CostingResultsPage (MoM 분석)
```

### 신규 컴포넌트들
```
✅ CostingSessionContext
✅ CostingCalculatorPage
✅ StaffCostInputTab
✅ ConsumableCostInputTab
✅ FixedCostInputTab
✅ ProcedureDefinitionTab
✅ CostingResultsView
```

### 데이터 마이그레이션
```typescript
// 기존 사용자를 위한 마이그레이션 가이드
interface MigrationHelper {
  // 기존 기준월 데이터를 세션으로 변환
  convertBaselineToSession(baseline: BaselineDetail): CostingSession;

  // /fixed-costs 연동 설정 안내
  setupFixedCostIntegration(): void;
}
```

---

## 📊 성능 및 품질 요구사항

### 성능 목표
- **초기 로딩**: 1초 이내
- **계산 응답**: 500ms 이내
- **데이터 저장**: 200ms 이내

### 품질 기준
- **TypeScript**: 100% 타입 커버리지
- **에러 처리**: 모든 비동기 작업에 try-catch
- **사용성**: 도움말 툴팁 제공
- **접근성**: WCAG 2.1 AA 준수

### 브라우저 호환성
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

---

## 🧪 테스트 계획

### 단위 테스트
```typescript
describe('CostingCalculator', () => {
  test('인력비 계산이 정확한가', () => {});
  test('소모품비 계산이 정확한가', () => {});
  test('고정비 배분이 올바른가', () => {});
  test('마진율 계산이 정확한가', () => {});
});
```

### 통합 테스트
- /fixed-costs 데이터 연동 테스트
- 세션 저장/불러오기 테스트
- 계산 결과 정확성 검증

### 사용자 테스트 시나리오
1. 신규 사용자의 첫 번째 분석 완료
2. 기존 고정비 데이터 활용한 분석
3. 여러 시술 비교 분석
4. 분석 결과 저장 및 공유

---

## 📅 출시 계획

### 단계별 출시
1. **Alpha (내부)**: 핵심 기능 검증
2. **Beta (제한된 사용자)**: 실제 의료진 피드백 수집
3. **GA (전체 공개)**: 완전한 기능 제공

### 피드백 수집 계획
- 사용 패턴 분석 (Google Analytics)
- 사용자 만족도 설문
- 기능 요청 및 개선사항 수집

---

## 🎯 성공 측정 지표

### 정량적 지표
- **월간 활성 사용자**: 기존 대비 200% 증가 목표
- **세션당 완료율**: 80% 이상
- **평균 사용 시간**: 15분 이내

### 정성적 지표
- **사용자 만족도**: 4.5/5.0 이상
- **기능 요청**: 월 5건 이하 (안정화 지표)
- **기술 부채**: 코드 복잡도 50% 감소

---

## 🚨 위험 요소 및 대응 방안

### 기술적 위험
- **데이터 마이그레이션 복잡성**
  - 대응: 단계적 마이그레이션, 백업 전략
- **기존 기능과의 충돌**
  - 대응: Feature Flag를 통한 점진적 전환

### 비즈니스 위험
- **사용자 학습 비용**
  - 대응: 인터랙티브 튜토리얼 제공
- **기존 워크플로우 변경 저항**
  - 대응: 기존 데이터 활용 가능한 마이그레이션 도구

### 일정 위험
- **예상 개발 기간 초과**
  - 대응: MVP 기능 우선 개발, 점진적 기능 추가

---

## 📚 참고 자료

### 기존 분석 문서
- [코스팅 모듈 아키텍처 분석 결과](../analysis/costing-architecture-review.md)
- [사용자 피드백 수집 결과](../research/user-feedback-costing.md)

### 기술 참고
- [React Context 최적화 가이드](https://react.dev/learn/passing-data-deeply-with-context)
- [TypeScript 타입 설계 베스트 프랙티스](https://typescript-eslint.io/docs/)

### 의료 업계 참고
- [의료기관 원가계산 가이드라인](https://example.com/medical-costing-guide)
- [헬스케어 IT 사용성 연구](https://example.com/healthcare-ux-research)

---

*이 PRD는 살아있는 문서로, 개발 과정에서 지속적으로 업데이트됩니다.*