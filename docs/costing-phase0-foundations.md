# Procedure Costing Phase 0 Foundations

## 1. 라우팅 & 접근 제어 합의안
- 신규 경로 `/costing/base`, `/costing/procedures`, `/costing/results` 는 `StaffLayout` 하위 `Routes` 에 추가한다.
  - `App.tsx` 에 `<Route path="costing/*" element={<CostingRouter />} />` 를 추가하고, `CostingRouter` 내부에서 `base` 기본 리다이렉트를 포함한 세부 경로를 구성한다.
  - `ProtectedRoute role="generalAdmin"` 정책을 재사용한다. 현재 정책에서 generalAdmin=admin 이므로 별도 권한 분기 없이 전체 기능을 허용한다.
- 사이드바(`src/components/Sidebar.tsx`) 업데이트
  - `staffNavItems` 배열에 `{ icon: <DocumentIcon />, label: '원가 인사이트', path: '/costing/base' }` 를 삽입한다.
  - `isInHospitalManagementMode` 로 분기되는 관리자 모드에서도 동일 항목이 노출되도록 조건을 검토한다.
- 초기 노출 제어
  - 간단한 `FeatureFlags` 상수 또는 서비스로 `costingModule` 플래그를 정의한다.
  - 플래그가 꺼져 있을 때는 사이드바에서 항목을 숨기고, `/costing/*` 접근 시 `/dashboard` 로 리다이렉트하여 베타 운영을 지원한다.

## 2. UI 컴포넌트 재사용 매트릭스
| 요구 화면 | 재사용 컴포넌트 | 소스 경로 | 커스터마이징 메모 |
| --- | --- | --- | --- |
| 기준월 선택 바 | `Header`, `MonthManagementModal` | `src/components/Header.tsx`, `src/components/modals/MonthManagementModal.tsx` | 상단에 기준월 셀렉터를 고정하고 버튼 문구만 변경 |
| 목록/편집 테이블 | `Table`, `TableHead`, `TableRow`, `TableCell` | `src/components/ui/Table.tsx` | 열 정의만 새로 작성하고 셀 에디터는 인라인 입력으로 재사용 |
| 저장/알림 | `useSaveNotification`, `NotificationModal`, `ConfirmationModal` | `src/hooks/useSaveNotification.ts`, `src/components/common/*` | 저장 성공/실패 토스트, 삭제 확인 등을 동일 패턴으로 연결 |
| 레이아웃 | `StaffLayout` | `src/layouts/StaffLayout.tsx` | 상단에 `CostingLayout` 래퍼를 추가하여 탭·필터 영역을 정비 |
| 마스터-디테일 패널 | `/account-management` 페이지 구조 | `src/pages/AccountManagementPage.tsx` | 왼쪽 목록 + 오른쪽 탭 구성 복제, 필드만 원가 데이터에 맞춰 교체 |

## 3. 기준월 상태 & 락 정책
```
Draft (기본)
  └─ saveBaseline() → Ready
  └─ lockSnapshot() → Locked
Locked
  └─ unlock(admin-only) → Draft (재계산 강제)
Ready
  └─ recalc() → Ready (결과 갱신)
  └─ lockSnapshot() → Locked
```
- `month_snapshot` 테이블 주요 컬럼
  - `status`: `DRAFT | READY | LOCKED`
  - `locked_at`, `locked_by`, `last_calculated_at`
  - `include_fixed_costs` (boolean), `applied_fixed_cost_ids` (JSONB)
- Locked 상태에서는 `/costing/base` 와 `/costing/procedures` 의 입력 필드를 비활성화하고 `/costing/results` 만 읽기 전용으로 제공한다.
- 기준월 관련 수정(인력, 소모품, 고정비 선택)은 `snapshot_change_log` 에 기록하여 Phase 6 감사 로그 구현을 대비한다.

## 4. 고정비 연동 UX 플로우
1. 기준월 생성 모달에서 `고정비 반영` 토글을 기본 ON 으로 제공한다.
2. 토글이 ON 인 경우 활성화된 고정비 템플릿을 체크박스 리스트로 출력하고, 기본값은 `fixed-costs` 모듈의 현재 활성 항목을 따른다.
3. 체크 상태가 바뀌면 우측 요약 패널에서 선택된 고정비 총합과 주요 항목을 즉시 업데이트한다.
4. 토글을 OFF 하면 계산 엔진에서 고정비 배분을 생략하도록 표시하고, 결과 화면에도 “고정비 미반영” 배지를 띄운다.
5. 저장 시 `snapshot_fixed_cost_link` 테이블에 `(snapshot_id, fixed_cost_template_id, include)` 형태로 upsert 한다.
6. `재계산` 버튼을 누르면 현재 기준월의 선택 상태를 읽어와 비용 배분을 다시 실행하고 결과 데이터를 갱신한다.

## 5. 서비스 인터페이스 초안
```ts
interface CostingSnapshotService {
  listSnapshots(tenantId: string): Promise<SnapshotSummary[]>;
  createSnapshot(payload: { tenantId: string; month: string; sourceMonth?: string | null; includeFixedCosts: boolean; }): Promise<SnapshotDetail>;
  updateFixedCostLinks(snapshotId: string, links: FixedCostLinkPayload[]): Promise<void>;
  updateStaffCapacity(snapshotId: string, input: StaffCapacityInput[]): Promise<void>;
  updateConsumablePricing(snapshotId: string, input: ConsumablePricingInput[]): Promise<void>;
  lockSnapshot(snapshotId: string): Promise<void>;
  unlockSnapshot(snapshotId: string): Promise<void>;
}

interface CostingCalculationService {
  recalc(snapshotId: string): Promise<CalculationResultSummary>;
  getResults(snapshotId: string): Promise<CostingResultRow[]>;
  getInsights(snapshotId: string): Promise<MomInsightPayload>;
}

interface FixedCostLinkService {
  listAvailableFixedCosts(tenantId: string, month: string): Promise<FixedCostTemplateSummary[]>;
  resolveDefaultInclusions(snapshotId: string): Promise<FixedCostLinkState>;
}
```
- 에러 형식은 `DomainError`(검증 실패), `ConflictError`(락 상태 변경 시도), `NotFoundError` 등을 `src/services/errors.ts` 로 분리해 공통 처리한다.

## 6. Supabase 대비 추상화 전략
- 서비스 구현 경로를 `src/services/costing/local/*`(현재) 와 `src/services/costing/supabase/*`(향후) 로 분리하고, `index.ts` 에서 의존성 주입 패턴을 사용한다.
- DTO ↔ UI 뷰 모델 매핑을 `src/services/costing/mappers.ts` 로 분리하여 API 응답 구조 변경에 유연하게 대응한다.
- 저장소 추상화(`getStorageProvider()`)를 도입해 로컬 스토리지 기반 프로토타입을 Supabase 또는 다른 백엔드로 쉽게 교체한다.

## 7. Phase 0 산출물 & 다음 액션
- [x] 구현 로드맵 문서 (`docs/procedure-costing-implementation-plan.md`).
- [x] Phase 0 토대 정리 문서 (본 문서).
- [ ] 고정비 선택 UX 와이어프레임(ASCII 다이어그램 혹은 FigJam 링크) 추가.
- [ ] 기준월 상태 ↔ HTTP 상태 코드 매핑 표 작성 (`LOCKED` → 409, `NOT_FOUND` → 404 등).
- [ ] DB 네이밍·마이그레이션 규칙 확인 후 Phase 1 스키마 초안을 작성한다.

## 8. 고정비 선택 UX 와이어프레임
```
[기준월 생성 모달]
┌──────────────────────────────────────────────┐
│ 월 선택: [ 2025-03 ▾ ]                      │
│----------------------------------------------│
│ 고정비 반영 (토글)  [ ON ]                  │
│                                              │
│ 고정비 항목 선택                            │
│ ┌─────────────┬──────────────┬─────────────┐ │
│ │ ✓  임대료   │ 1,200,000원  │ 기본 선택   │ │
│ │ ✓  감가상각 │   450,000원  │ 기본 선택   │ │
│ │ ☐  보험료   │   180,000원  │ 사용자 해제 │ │
│ │ ✓  장비리스 │   390,000원  │ 기본 선택   │ │
│ └─────────────┴──────────────┴─────────────┘ │
│                                              │
│ [선택 요약]                                  │
│  총 고정비: 2,040,000원                      │
│  최근 변경: 보험료 제외 (사용자)             │
│----------------------------------------------│
│ [취소]                      [저장 및 계속]   │
└──────────────────────────────────────────────┘

[기준월 상세 - 고정비 섹션]
┌──────────────────────────────────────────────┐
│ 고정비 반영 (토글)  [ ON ]                  │
│ (필수) 원가 계산에 포함할 항목을 선택하세요 │
│----------------------------------------------│
│ 장비/계약명     월 금액     상태   [✓]       │
│----------------------------------------------│
│ 임대료         1,200,000   기본   [✓]       │
│ 감가상각         450,000   기본   [✓]       │
│ 보험료           180,000   선택   [ ]       │
│ 장비리스         390,000   기본   [✓]       │
│----------------------------------------------│
│ 선택 고정비 합계: 2,040,000원                │
│ 재계산 필요 여부: ● (선택 변경)              │
│ [변경사항 저장]    [재계산 실행]             │
└──────────────────────────────────────────────┘
```
- 토글 OFF 시 목록과 요약 패널을 회색 처리하고 “고정비 미반영” 배지를 표시한다.
- 체크 상태가 바뀌면 우측 요약과 재계산 필요 표시가 즉시 업데이트된다.
- 기본 선택 항목은 `fixed-costs` 모듈의 활성 상태를 반영하며, 사용자 수정 내역은 기준월에 저장한다.

## 9. 기준월 상태 ↔ HTTP 상태 코드 매핑
| 상태/이벤트 | 설명 | API 응답 코드 | 처리 지침 |
| --- | --- | --- | --- |
| Draft에서 필드 수정 | 초안 상태에서 자유롭게 편집 가능 | 200 OK | 저장 성공 토스트, 변경 이력 기록 |
| Draft → Ready 저장 | 필수 데이터 검증 통과 후 저장 | 200 OK | `last_calculated_at` 업데이트, 재계산 권장 배지 |
| Ready 재계산 요청 | 최신 데이터로 비용 재계산 | 202 Accepted (비동기) / 200 OK (동기) | 계산 프로세스 큐잉, 완료 토스트 |
| Locked 상태에서 수정 시도 | 락된 기준월에 쓰기 요청 | 409 Conflict | UI에 “잠금 해제 필요” 경고, 해제 액션 노출 |
| 존재하지 않는 기준월 조회 | 잘못된 ID 또는 삭제됨 | 404 Not Found | “기준월을 찾을 수 없습니다” 메시지, 목록으로 리다이렉트 |
| 권한 없음 | 비관리자 접근 | 403 Forbidden | 로그인/권한 안내, `/dashboard` 로 이동 |
| 중복 생성 시도 | 동일 월 기준월 이미 존재 | 409 Conflict | 기존 기준월 링크 제공 |
| 서버 오류 | 계산 엔진 실패 등 | 500 Internal Server Error | 에러 로그 기록, 사용자에게 재시도/지원 안내 |
## 10. DB 네이밍 & 마이그레이션 가이드 (Phase 1 준비)
- **네이밍 규칙**
  - 테이블/뷰: `snake_case` 복수형 (`month_snapshots`, `procedure_variants`).
  - 기본 키: `id`(UUID), 관계 컬럼은 `<entity>_id` (`tenant_id`, `snapshot_id`).
  - 타임스탬프: `created_at`, `updated_at`, 상태 전환은 `locked_at`, `last_calculated_at` 등 명시적 이름 사용.
  - 상태 컬럼은 ENUM 대신 `TEXT CHECK` 제약을 우선 적용하여 Supabase 마이그레이션과 호환성을 유지한다.
- **마이그레이션 파일 구조**
  - 경로: `db/migrations/<timestamp>_<slug>.sql` (예: `db/migrations/20241012_costing_snapshots.sql`).
  - 각 파일은 `BEGIN; ... COMMIT;` 블록으로 감싸고, 롤백을 위한 `-- rollback:` 주석에 역쿼리를 병기한다.
  - 기본 데이터 시드가 필요한 경우 `-- seed:` 블록을 별도로 명시하며, 테스트 환경에서는 비워둘 수 있도록 조건 처리.
- **관계 및 인덱스**
  - 모든 FK는 `ON DELETE CASCADE` 또는 `ON DELETE RESTRICT` 를 명시한다. 기본값은 `CASCADE` 대신 `RESTRICT` 로 설정하고 필요 시 예외를 둔다.
  - 자주 조회하는 조합(`tenant_id`, `month`, `status`)은 복합 인덱스를 정의하고, 결과 테이블은 `(snapshot_id, procedure_variant_id)` 인덱스를 기본 제공한다.
- **스크립트 운영**
  - 로컬 개발은 `npm run db:migrate` 스크립트에 새 파일을 추가해 순차 실행하고, CI 환경에서도 동일 스크립트를 활용한다.
  - 마이그레이션 전후로 `npm run build` 를 실행해 타입/서비스 코드가 스키마 변경과 일관된지 검증한다.
  - Supabase 전환 시 `supabase db push` 파이프라인과 호환되도록 DDL만 작성하고, 데이터 보정은 별도 스크립트 혹은 API 단계에서 처리한다.
- **검증 체크리스트**
  1. FK/인덱스/유니크 제약이 요구사항을 모두 충족하는지 검토한다.
  2. 락 상태 변환 시나리오를 SQL 레벨에서 재현해본 후, 잘못된 상태 전이가 발생하면 트랜잭션으로 롤백되는지 확인한다.
  3. `month` 컬럼은 `YYYY-MM` 형식의 `TEXT` + 체크 제약(정규식)으로 관리하고, Supabase 연동 시 `DATE` 변환 계획을 별도 기록한다.

