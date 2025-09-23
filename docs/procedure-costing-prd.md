# Procedure Costing & Insight Module PRD

## 1. Background & Objectives
- **Project context**: Extend the existing financial project with an end-to-end procedure-costing system for clinics/hospitals. The module must run alongside financial dashboards but share fixed-cost data where relevant.
- **Primary goal**: Accurately compute margin and margin rate for every procedure performed within a given month by combining consumable costs, labor allocation, and fixed-cost allocations.
- **Drivers**:
  - Provide actionable insight into the most performed and most profitable procedures per month.
  - Support procurement and staffing decisions by exposing cost composition (consumables vs. labor vs. allocated fixed cost).
  - Offer period-over-period insight (e.g., month-over-month change) to guide strategy adjustments.

## 2. Scope
- In-scope
  - Monthly snapshot creation and management for costing data.
  - Data entry UI for staffing, consumables, procedures, and actual procedure counts.
  - Cost calculation engine producing per-procedure cost breakdown, margins, and insight dashboards.
  - Month-over-month comparison view (instead of scenario overrides).
  - Export (CSV/Excel) capabilities for costing results.
- Out of scope (for initial release)
  - Automated ingestion from EMR/CRM (manual CSV upload acceptable, integration in future phase).
  - Real-time inventory depletion tracking (only costing-level consumption needed now).
  - Automated anomaly detection or AI recommendations (manual insights provided via dashboards).
  - Labor adjustments for mid-month overtime/leave (future enhancement).
  - Consumable loss/pason handling; assume all purchased yield is usable (documented assumption).

## 3. Stakeholders & Users
- **Clinic Owner / Director**: Reviews profitability and decides pricing strategy.
- **Head Nurse / Staff Manager**: Maintains staffing data and validates labor allocations.
- **Procurement Manager**: Updates consumable costs and usage assumptions.
- **Finance/Operations Analyst**: Runs monthly snapshots, validates results, exports reports.

## 4. Success Metrics
- Ability to generate a complete cost + margin table for all procedures within a month without manual spreadsheet work.
- Reduction in manual reconciliation time vs. current Excel-based process.
- Accuracy: <2% variance between calculated results and verified manual calculations for sample procedures.
- Adoption: key personas rely on the module monthly instead of Excel for decision support.

## 5. High-Level Architecture
- **Front-end**: React + TypeScript (existing Vite app) with Context/hooks-based state management.
- **Back-end / Services**: Extend `src/services/` with REST endpoints to manage costing data.
- **Data Storage**: Database schema additions (see Section 7) accommodating monthly snapshots, staffing, consumables, procedures, and results.
- **Computation Flow**: Server-side cost calculation service triggered per month snapshot, producing immutable result rows for reference and comparison.
- **Integration Points**:
  - Reuse existing `fixed-costs` table/service for monthly fixed cost values.
  - Pull specific equipment lease/installment costs from `fixed-costs` when a procedure references equipment via linkage.

### Architecture Diagram (Conceptual)
1. **UI Layer** (Sidebar menu → tabbed views)
   - interacts with `CostingService` via REST/GraphQL.
2. **Costing Service**
   - orchestrates CRUD for staffing/consumables/procedures.
   - triggers `CostingEngine` to compute results.
3. **Costing Engine**
   - fetches snapshot data → calculates per-procedure costs → writes to `procedure_cost_result` & `procedure_performance_summary`.
4. **Database**
   - stores baseline data (`staff_roles`, `consumable_catalog`, etc.), monthly overrides, and calculated outputs.
5. **Shared Fixed Cost Module**
   - existing financial module providing monthly fixed-cost values (facility, equipment leases) consumed by the costing engine.

## 6. Monthly Snapshot Workflow
1. **Create or select `month_snapshot`** (e.g., `2025-09`) → initializes baseline records with default values from previous month if available.
2. **Staff Setup** (`staff_capacity` entries) → user inputs role counts, monthly payroll, working days/hours.
3. **Consumable Pricing** (`consumable_prices`) → user inputs purchase unit, purchase cost, usage unit, yield per purchase (e.g., Ulthera tip 1 set = 2,400 shots @ ₩3,500,000 → derived unit cost ≈ ₩1,458.33/shot). Document assumption: no wastage/pason handling yet.
4. **Procedure Definition**
   - `procedure_catalog`: create/select procedure.
   - `procedure_variant` (per month): set sale price, preparation time, total time, associated equipment ID (optional) to link lease costs.
   - `procedure_staff_mix`: assign roles, participants, and time per role (use `시술소요시간` for hands-on roles).
   - `procedure_consumable_usage`: assign consumables and quantities (e.g., 300 shots per treatment).
   - `procedure_equipment_link`: declare equipment needed for the procedure (links to `fixed-costs` entries for lease/installment).
5. **Actuals Input** (`procedure_actuals`): import or enter procedure counts and actual duration adjustments.
6. **Cost Calculation Execution**
   - Derive role-wise cost per minute from staff data.
   - Compute consumable costs per procedure variant.
   - Allocate fixed costs:
     - Facility-level fixed costs (rent, insurance, general utilities) based on total minutes.
     - Equipment-specific costs: when a procedure is linked to equipment lease/installment entries, allocate proportionally by usage (derived from `total_minutes` or custom equipment usage minutes if provided).
   - Store results in `procedure_cost_result` and aggregated metrics in `procedure_performance_summary`.
7. **Insight Review**
   - UI surfaces top procedures by count and margin.
   - Provide detailed breakdown, month-over-month change view.
   - Support CSV export of tables.
8. **Month Locking**
   - Option to lock snapshot after review to prevent accidental edits.

## 7. Data Model & DB Hierarchy
_All tables include standard metadata (`id`, `created_at`, `updated_at`, `created_by`, `updated_by`). Foreign keys cascade respecting `month_snapshot` as top-level scope._

### 7.1 Core Reference Tables
- `hospitals`
  - `id`
  - `name`, `timezone`, `operating_hours_config`
- `staff_roles`
  - `id`
  - `hospital_id`
  - `name` (e.g., Doctor, Nurse, Counselor)
  - `description`
- `equipment_catalog`
  - `id`
  - `hospital_id`
  - `name`
  - `description`
  - `fixed_cost_entry_id` (optional FK to specific lease/installment in shared `fixed-costs`)
- `consumable_catalog`
  - `id`
  - `hospital_id`
  - `manufacturer`
  - `product_name`
  - `specification`
  - `usage_unit` (e.g., shot, vial)
  - `is_active`
- `procedure_catalog`
  - `id`
  - `hospital_id`
  - `code`
  - `name`
  - `category`
  - `is_active`

### 7.2 Monthly Snapshot Tables
- `month_snapshot`
  - `id`
  - `hospital_id`
  - `month` (YYYY-MM)
  - `status` (draft/locked)
  - `base_snapshot_id`
  - `notes`
- `fixed_cost_entries`
  - `id`
  - `month_snapshot_id`
  - `category` (rent, insurance, lease-equipment, etc.)
  - `amount`
  - `allocation_scope` (`facility`, `equipment`, `manual`)
  - `equipment_id` (nullable; when `allocation_scope = equipment`)
  - `notes`
- `staff_capacity`
  - `id`
  - `month_snapshot_id`
  - `staff_role_id`
  - `headcount`
  - `monthly_payroll`
  - `working_days`
  - `daily_hours`
  - `available_minutes` (auto-calculated via stored procedure or computed field)
- `consumable_prices`
  - `id`
  - `month_snapshot_id`
  - `consumable_id`
  - `purchase_unit_label`
  - `purchase_unit_cost`
  - `yield_per_unit`
  - `unit_cost` (derived)
  - `effective_date`
- `procedure_variant`
  - `id`
  - `month_snapshot_id`
  - `procedure_id`
  - `sale_price`
  - `procedure_minutes`
  - `total_minutes`
  - `equipment_id` (nullable; references `equipment_catalog` to pull related fixed costs)
  - `description`
- `procedure_staff_mix`
  - `id`
  - `procedure_variant_id`
  - `staff_role_id`
  - `participants`
  - `role_minutes`
- `procedure_consumable_usage`
  - `id`
  - `procedure_variant_id`
  - `consumable_id`
  - `usage_quantity`
  - `usage_unit`
- `procedure_actuals`
  - `id`
  - `month_snapshot_id`
  - `procedure_variant_id`
  - `case_count`
  - `avg_procedure_minutes`
  - `avg_total_minutes`
- `snapshot_change_log`
  - `id`
  - `month_snapshot_id`
  - `entity_type`
  - `entity_id`
  - `action`
  - `payload`
  - `changed_by`
  - `changed_at`

### 7.3 Computed Tables
- `procedure_cost_result`
  - `id`
  - `month_snapshot_id`
  - `procedure_variant_id`
  - `direct_consumable_cost`
  - `labor_cost`
  - `facility_fixed_cost`
  - `equipment_fixed_cost`
  - `manual_adjustments` (optional future use)
  - `total_cost`
  - `sale_price`
  - `margin`
  - `margin_rate`
  - `margin_per_minute`
  - `cost_breakdown_json`
- `procedure_performance_summary`
  - `id`
  - `month_snapshot_id`
  - `procedure_variant_id`
  - `total_cases`
  - `total_revenue`
  - `total_cost`
  - `total_margin`
  - `total_minutes`
  - `avg_margin_rate`
- `month_insight_summary`
  - `id`
  - `month_snapshot_id`
  - `top_procedure_by_volume`
  - `top_procedure_by_margin`
  - `lowest_margin_rate_procedure`
  - `mom_volume_change_json`
  - `mom_margin_change_json`
  - `notes`

### 7.4 Views & Indexes
- `vw_costing_equipment_allocation`: joins procedures with equipment-specific fixed costs.
- Index `(month_snapshot_id, procedure_variant_id)` on all major tables.
- Index `(equipment_id)` on `procedure_variant` and `fixed_cost_entries` for fast equipment lookups.

## 8. Cost Calculation Logic Details
### 8.1 Labor Cost
- `role_cost_per_minute = monthly_payroll / available_minutes` (entered via staff setup).
- `labor_cost = Σ (participants × role_minutes × role_cost_per_minute)` using `procedure_staff_mix` rows.
- No overtime/leave adjustments in v1 (documented assumption).

### 8.2 Consumable Cost
- `unit_cost = purchase_unit_cost / yield_per_unit` recorded per month.
- `direct_consumable_cost = Σ (usage_quantity × unit_cost)`.
- Example: Ulthera tip 1 set ₩3,500,000, yield 2,400 shots → unit cost 1,458.33원; usage 300 shots → ₩437,500 per treatment.

### 8.3 Fixed Cost Allocation
- **Facility-level costs** (allocation_scope `facility`):
  - Denominator = Σ(`total_minutes` × `case_count`) across all active procedures.
  - `facility_fixed_cost_rate = total_facility_cost / denominator`.
  - `facility_fixed_cost = facility_fixed_cost_rate × procedure_variant.total_minutes`.
- **Equipment-specific costs** (allocation_scope `equipment`):
  - Map procedures to equipment via `procedure_variant.equipment_id`.
  - For equipment E:
    - Denominator_E = Σ(`equipment_usage_minutes` × `case_count`) for procedures referencing E. Default `equipment_usage_minutes = total_minutes` (documented assumption), future enhancement: allow specific equipment minutes.
    - `equipment_fixed_cost_rate_E = lease_cost_E / denominator_E`.
    - `equipment_fixed_cost = equipment_fixed_cost_rate_E × equipment_usage_minutes`.
- **Manual allocation** (if needed later): manual cost entries recorded but not yet distributed in v1.
- Assumption: procedures not using linked equipment do not consume equipment-specific costs; future enhancement may include fallback rules.

### 8.4 Margin & Derived Metrics
- `total_cost = direct_consumable_cost + labor_cost + facility_fixed_cost + equipment_fixed_cost`.
- `margin = sale_price - total_cost`.
- `margin_rate = margin / sale_price`.
- `margin_per_minute = margin / total_minutes`.
- `mom_change` metrics derived by comparing current snapshot vs. previous snapshot in `month_insight_summary`.

## 9. UI/UX Specification

### 9.1 Navigation Structure
- Sidebar parent: `원가 계산 인사이트`.
  - `기본 설정` (`/costing/base`)
  - `시술 설정` (`/costing/procedures`)
  - `결과 & 인사이트` (`/costing/results`)

### 9.2 Global Layout & Styling
- Reuse main layout; add `CostingLayout` wrapper with snapshot selector at top.
- Global CSS: either extend `src/index.css` or add `src/styles/costing.css` (prefixed `.costing-`).
- Components built with existing design tokens; maintain 2px border radius, typography scale consistent with project.
- Responsiveness: tables scroll horizontally; cards wrap at breakpoints.

### 9.3 화면 상세 & UX Flow

#### A. 기본 설정
- Tabs: `인력 설정`, `소모품 단가`.
- Each tab features editable tables with “변경사항 저장하기” CTA; unsaved changes indicator.
- Month snapshot selector locked when status = locked; editing disabled.

#### B. 시술 설정
- Master list of procedures on left; detail panel on right with tabs: `기본 정보`, `인력 구성`, `소모품 사용`, `장비 연결`.
- “변경사항 저장하기” button persists changes; unsaved changes banner if navigating away.
- Validation: require at least one staff role and one consumable for calculation readiness.

#### C. 결과 & 인사이트
- Tabs: `시술별 원가표`, `월간 인사이트` (no scenario compare in v1).
  - `시술별 원가표`: full table with export, sort, filter.
  - `월간 인사이트`: KPI cards (volume/margin leaders, lowest margin), month-over-month change table/graph, notes column for key observations.
- Provide compare selector: `현재 월` vs. `이전 월` (pull from locked snapshots).

### 9.4 Component Reuse & Structure
- Reuse existing shared components.
- New components under `src/components/costing/`:
  - `SnapshotSelector`, `StaffCapacityTable`, `ConsumablePricingTable`, `ProcedureEditor`, `EquipmentLinker`, `CostingDataTable`, `InsightSummaryCards`, `MomChangeChart`.
- Hooks under `src/hooks/`: `useMonthSnapshot`, `useUnsavedChanges` (shared with other modules), `useCostingResults`.
- Context provider `CostingSnapshotProvider` to share selected snapshot and lock state across tabs.

### 9.5 Form Protection & Unsaved Changes
- Each edit view maintains local form state; `변경사항 저장하기` commits via service.
- Navigating away with dirty state triggers confirm dialog (“저장하지 않은 변경사항이 있습니다…”).
- Autosave not in scope v1.

## 10. API & Service Contracts (Conceptual)
- `GET /costing/snapshots?hospitalId=&month=`
- `POST /costing/snapshots`
- `PATCH /costing/snapshots/:id`
- `PUT /costing/snapshots/:id/staff`
- `PUT /costing/snapshots/:id/consumables`
- `GET /costing/snapshots/:id/procedures`
- `POST /costing/snapshots/:id/procedures`
- `PUT /costing/snapshots/:id/procedures/:variantId`
- `POST /costing/snapshots/:id/recalculate`
- `GET /costing/snapshots/:id/results`
- `GET /costing/snapshots/:id/mom-insight`
- CSV upload endpoints for staff/consumables/procedures (future optional).

## 11. Validation & Edge Cases
- Prevent calculation if required data missing: no staff capacity for referenced role, missing consumable pricing, missing equipment cost for linked equipment.
- Locked snapshots reject write operations.
- CSV imports require schema validation; show inline error summary (row, column, reason).
- Document assumptions: no overtime adjustment, no consumable wastage, equipment usage minutes = total minutes unless overridden.

## 12. Analytics & Reporting
- Audit log via `snapshot_change_log` for staffing/consumables/procedures changes.
- Usage analytics: track which tabs/users edit most to inform UX improvements.
- Provide change history timeline per snapshot (powered by change log).

## 13. Security & Permissions
- Role-based access: Admin (full), Analyst (view/export/run calculation), Editor (edit unlocked data).
- Payroll and cost data accessible only to permitted roles.
- All endpoints require auth; rate limit write operations to prevent abuse.

## 14. Performance Considerations
- Batch updates for large tables.
- Cache read-heavy endpoints; leverage pagination on procedure lists.
- Precompute month-over-month deltas during calculation stage for fast UI rendering.

## 15. Testing Strategy
- Unit tests for costing engine (labor, consumable, fixed allocation).
- Integration tests for snapshot lifecycle and calculation flows.
- Manual smoke tests via `npm run build` + `npm run preview`.
- Fixture-based regression tests for Ulthera tip example and other representative procedures.

## 16. Rollout Plan
- Phase 1: Schema migrations, staffing/consumable UI, snapshot CRUD.
- Phase 2: Procedure editor, equipment linkage, costing engine, result tables.
- Phase 3: Month-over-month insights, exports, audit log UI.
- Beta: run parallel with Excel for 1–2 months to validate accuracy; collect user feedback.

## 17. Open Questions & Risks
- Future: incorporate equipment idle time tracking? (Documented as enhancement.)
- How to reconcile when fixed-cost data is corrected post-lock? Need policy (unlock vs. versioning).
- Need fallback when previous month snapshot missing for MoM comparison (display N/A).

## 18. Appendices
- **Terminology**
  - 시술소요시간: hands-on time; used for labor calculations per role.
  - 총소요시간: total occupied time; used for facility fixed-cost allocation.
  - 장비 연결: mapping procedure variant to equipment lease/installment for cost allocation.
- **Ulthera Tip Example**
  - Input: 1 set @ ₩3,500,000 yields 2,400 shots.
  - Unit cost: ₩1,458.33 per shot.
  - Usage: 300 shots → consumable cost ₩437,500 per treatment.
  - Add relevant labor & fixed cost to compute margin.

