 변동비/고정비 분리 작업 상세 보고서

  🏗️ 아키텍처 위계 변경사항

  1. 데이터 모델 레벨 (types.ts)

  // ✅ 추가: 새로운 분류 체계
  export type MainCategory = 'REVENUE' | 'EXPENSE';

  // ✅ 확장: Account 인터페이스
  export interface Account {
    // 기존 속성들...
    mainCategory?: MainCategory; // 2대 분류 추가
    // category: AccountCategory  // 4대 분류 유지 (호환성)
  }

  목적: Excel 기반 2대 분류와 기존 4대 분류 병행 지원

  ---
  2. 비즈니스 로직 레벨 (DatabaseService.ts)

  2.1 템플릿 구조 재설계

  // ✅ 새로운 Excel 기반 템플릿 생성
  const excelBasedFinancials: Financials = {
    accounts: {
      revenue: [7개 계정],     // 매출내역 (베가스, 어플리케이션, 기타매출)
      cogs: [8개 계정],        // 원재료/외주용역 (순수 변동원가)
      sgaFixed: [5개 계정],    // 고정비 (기존 유지)
      sgaVariable: [7개 계정], // 순수 변동비만 (고정비 성격 제거)
    }
  }

  2.2 중복 제거 및 분류 정리

  // ❌ 제거된 중복/오분류 항목들
  - '직원 인건비' (sgaVariable에서 제거) → 고정비 영역으로
  - '공과금/관리비' (sgaVariable 중복 제거) → 고정비만 유지
  - '청소 서비스' (sgaVariable에서 제거) → 고정비 성격
  - '교육/복지비' (sgaVariable에서 제거) → 고정비 성격

  // ✅ 순수 변동비만 유지
  - '소모품/소모재', '마케팅/광고비', 'CRM 비용', '이벤트 비용'

  2.3 그룹 구조 재편

  // 변경 전
  sga: ['인건비', '운영비', '마케팅비', '금융비용', '기타비용']

  // 변경 후 ✅
  sga: ['소모품/운영', '마케팅비', '기타변동비']  // 순수 변동비 그룹만

  2.4 입력 방식 통일

  // ✅ 변동비 영역: 100% transaction
  REVENUE → entryType: 'transaction' (거래별 상세 관리)
  COGS → entryType: 'transaction' (거래별 상세 관리)
  SGA_VARIABLE → entryType: 'transaction' (거래별 상세 관리)

  // ✅ 고정비 영역: 100% manual
  SGA_FIXED → entryType: 'manual' (월별 총액 입력)

  ---
  🎨 프레젠테이션 레벨 (UI Components)

  3.1 AccountManagementPage 구조 변경

  // 변경 전: 3단 구조
  ┌──────────────┬──────────────┬──────────────┐
  │   매출계정   │ 매출원가계정 │ 판매비관리비 │
  └──────────────┴──────────────┴──────────────┘

  // 변경 후 ✅: 2단 구조
  ┌─────────────────┬─────────────────┐
  │   매출내역      │   지출내역      │
  │ (REVENUE)       │ (COGS+SGA_VAR)  │
  └─────────────────┴─────────────────┘

  3.2 IncomeStatementPage 구조 변경

  // 변경 전: 분산 표시
  - 매출 내역 (별도)
  - 매출원가 (별도)
  - 변동 판매비와 관리비 (별도)

  // 변경 후 ✅: 통합 표시
  - 매출내역 (REVENUE)
  - 지출내역 (COGS + SGA_VARIABLE 통합)

  ---
  💾 데이터베이스 위계 변경사항

  4.1 데이터 분리 정책

  // ✅ 관리 영역별 데이터 분리
  localStorage['financialData']['tenant-1'] = {
    accounts: {
      // 변동비 영역 (/account-management에서 관리)
      revenue: [...],      // 매출 거래
      cogs: [...],         // 변동 원가
      sgaVariable: [...],  // 변동 판관비

      // 고정비 영역 (/fixed-costs에서 관리)
      sgaFixed: [...],     // 고정 판관비
    }
  }

  4.2 계산 로직 분리

  // useFinancialData.ts 내부 계산
  const calculatedData = {
    // 변동비 합계 (transaction 기반)
    revenue: REVENUE 계정들의 거래 합계,
    cogs: COGS 계정들의 거래 합계,
    sgaVariable: SGA_VARIABLE 계정들의 거래 합계,

    // 고정비 합계 (manual 기반)
    sgaFixed: SGA_FIXED 계정들의 월별 입력값 합계,

    // 통합 계산
    totalSga: sgaFixed + sgaVariable,
    operatingProfit: revenue - cogs - totalSga
  }

  4.3 데이터 흐름 정리

  📊 사용자 입력
  ├── 변동비 입력 (/account-management, /income-statement)
  │   └── transactionData[month][accountId][] 저장
  └── 고정비 입력 (/fixed-costs)
      └── fixedCostActuals[] 저장

  📊 계산 엔진 (useFinancialData.ts)
  ├── accountValues: 모든 계정의 월별 합계
  ├── calculatedData: 손익계산서 항목별 합계
  └── 화면 표시

  📊 UI 표시
  ├── /income-statement: 변동비만 상세 표시
  └── 손익요약: 고정비+변동비 통합 결과

  ---
  🎯 달성된 목표

  1. 관리 영역 완전 분리 ✅

  - /account-management: REVENUE, COGS, SGA_VARIABLE만 (순수 변동비)
  - /fixed-costs: SGA_FIXED만 (순수 고정비)
  - 혼재 로직 제거: 같은 성격 비용의 중복 관리 제거

  2. 입력 방식 통일 ✅

  - 변동비: 100% transaction (거래별 상세 관리)
  - 고정비: 100% manual (월별 총액 입력)

  3. 데이터 무결성 보장 ✅

  - 중복 제거: '공과금/관리비' 중복 제거
  - 올바른 분류: 고정적 성격 비용을 고정비로 이동
  - 일관성: 같은 카테고리 내 동일한 입력 방식

  4. 기술 부채 최소화 ✅

  - 단일 책임 원칙: 각 페이지가 명확한 역할
  - 확장성: 사용자 정의 그룹/계정 추가 가능
  - 유지보수성: 로직 분리로 수정 영향 범위 최소화