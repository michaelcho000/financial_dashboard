# Procedure Costing Implementation Plan

## 개요
- 목표: 기존 재무 모듈에 영향을 주지 않고 절차 원가·인사이트 모듈을 단계적으로 도입하며, 향후 Supabase 연동을 대비한 인터페이스를 선제적으로 준비한다.
- 범위: 월별 기준월 생성, 인력/소모품 데이터 관리, 고정비 선택 및 배분, 시술별 원가 계산, 결과/인사이트 UI 제공.
- 전제: 현재는 `admin`(=generalAdmin) 사용자만 접근하며 모든 권한을 부여한다. 향후 역할 확장은 기능 플래그나 권한 테이블 확장을 통해 처리한다.

## 추진 원칙
- **위계 보존**: `/income-statement`, `/account-management`, `fixed-costs` 모듈에 직접적인 변경 없이 `Costing` 모듈을 별도의 네임스페이스로 추가한다.
- **UI 재사용**: 테이블, 탭, 토스트 등 기존 컴포넌트를 최대한 재활용하고 필요한 경우 스타일 토큰 범위 내에서만 커스터마이즈한다.
- **기술부채 최소화**: 서비스 계층 인터페이스(`CostingSnapshotService`, `CostingCalculationService`, `FixedCostLinkService`)를 분리해 Supabase 전환 시 어댑터만 교체하도록 설계한다.
- **데이터 무결성**: 기준월 상태(초안/확정/락)와 고정비 선택 정보를 서버가 단일 출처로 관리하며, UI는 상태를 명확히 표시한다.
- **UX 일관성**: 더티 상태 경고, 저장 성공 토스트, 탭 이동 패턴 등 기존 화면과 동일한 사용자 흐름을 유지한다.

## Phase Roadmap & Priorities
1. **Phase 0 · Foundations**
   - 라우팅/사이드바 구조 정의, 접근 제어 정책 확정.
   - `fixed-costs` 서비스·UI 의존성 조사, 재사용 가능한 컴포넌트 카탈로그 작성.
   - 기준월 상태/락 정책, 고정비 선택 UX, 서비스 인터페이스 문서화.
2. **Phase 1 · Schema & Service Contract**
   - DB 마이그레이션 초안 작성(`month_snapshot`, `snapshot_fixed_cost_link`, `staff_capacity`, `consumable_price`, `procedure_variant` 등).
   - REST API 계약(요청/응답 포맷, 에러 코드)과 롤백 전략 수립.
   - 고정비 선택 토글/체크 상태 저장 규칙 정의.
3. **Phase 2 · Base Settings UI**
   - `/costing/base` 페이지 구현: 기준월 선택, 인력/소모품 테이블, 저장/검증 흐름.
   - 기준월 생성/복제 API 연동, 락 상태 UI 제약 확인.
   - 더티 상태 관리 훅과 토스트/에러 처리 연결.
4. **Phase 3 · Procedure Editor & Fixed Cost Linking**
   - `/costing/procedures` 레이아웃 구현: 마스터-디테일 구조, 인력/소모품/장비 탭.
   - 고정비 반영 토글 + 체크박스 UI와 서비스 연동, 실시간 요약 패널 제공.
   - 필수 입력 검증 및 사용자 안내 메시지 확산.
5. **Phase 4 · Calculation Engine**
   - 서버측 계산 서비스 구현: 인력/소모품/고정비 배분 알고리즘, 에러 로깅.
   - 결과 저장 테이블(`procedure_cost_result`, `procedure_performance_summary`) 작성 및 재계산 트리거.
   - 트랜잭션/롤백, 단위·통합 테스트 작성.
6. **Phase 5 · Results & Insights UI**
   - `/costing/results` 화면: 시술별 원가표, KPI 카드, MOM 비교 차트, CSV Export.
   - 이전 기준월 비교 로직, 고정비 반영 상태 표시, 반응형/접근성 검토.
7. **Phase 6 · Hardening & Rollout**
   - 감사 로그, 역할 확장 플래그, 캐싱/배치 최적화.
   - QA 체크리스트, 베타 릴리즈 플랜, 문서화 업데이트.

## 교차 과제
- **컴포넌트 재사용 카탈로그**: `/income-statement`, `/account-management`, `FixedCostsPage` 에서 재활용할 테이블 헤더·입력 컴포넌트·모달을 목록화한다.
- **오류/상태 관리**: `useSaveNotification`, 공통 토스트, 에러 타입 정의를 활용해 일관된 사용자 피드백을 제공한다.
- **국제화/표기**: `formatCurrency`, 날짜 포맷 유틸을 재사용하며 필요 시 추가 보정한다.
- **테스트 전략**: 계산 엔진 단위 테스트, 기준월 라이프사이클 통합 테스트, 주요 시나리오 QA 스크립트 정의.

## 리스크 & 대응
- **고정비 데이터 변경**: 기존 모듈에서 고정비가 수정될 때 기준월 재계산이 필요 → 변경 이벤트 감지 후 재계산 큐에 등록.
- **대량 데이터 성능**: 테이블 페이징/가상 스크롤 검토, 계산 엔진 배치 처리 도입.
- **락 상태 혼란**: UI 배지/툴팁, API 409 응답 등으로 상태를 명확히 안내.
- **Supabase 전환**: 서비스 인터페이스와 DTO를 모듈화해 RPC 기반 구현으로 교체 시 영향 최소화.

## 즉시 후속 작업
1. Phase 0 문서(라우팅/권한/UX/서비스 인터페이스) 작성을 위한 레퍼런스 코드 정리.
2. 고정비 선택 UX 와이어프레임 초안 작성 후 이해관계자 검토 요청.
3. DB 네이밍 규칙 확인 및 Phase 1 마이그레이션 초안 작업 착수.

