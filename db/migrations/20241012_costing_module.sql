-- Procedure costing module schema (Phase 1)
-- Generated on 2025-09-26

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS month_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    month TEXT NOT NULL CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'READY', 'LOCKED')),
    include_fixed_costs BOOLEAN NOT NULL DEFAULT TRUE,
    applied_fixed_cost_ids JSONB NOT NULL DEFAULT '[]'::JSONB,
    locked_at TIMESTAMPTZ,
    locked_by UUID,
    last_calculated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, month)
);

CREATE INDEX IF NOT EXISTS idx_month_snapshots_tenant_status
    ON month_snapshots (tenant_id, status);

CREATE TABLE IF NOT EXISTS snapshot_fixed_cost_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id UUID NOT NULL REFERENCES month_snapshots (id) ON DELETE CASCADE,
    fixed_cost_template_id UUID NOT NULL,
    included BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (snapshot_id, fixed_cost_template_id)
);

CREATE INDEX IF NOT EXISTS idx_snapshot_fixed_cost_links_snapshot
    ON snapshot_fixed_cost_links (snapshot_id);

CREATE TABLE IF NOT EXISTS procedure_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, LOWER(name))
);

CREATE TABLE IF NOT EXISTS staff_capacities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id UUID NOT NULL REFERENCES month_snapshots (id) ON DELETE CASCADE,
    role_id UUID,
    role_name TEXT NOT NULL,
    monthly_payroll NUMERIC(14, 2) NOT NULL,
    available_minutes INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_capacities_snapshot
    ON staff_capacities (snapshot_id);

CREATE TABLE IF NOT EXISTS consumable_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id UUID NOT NULL REFERENCES month_snapshots (id) ON DELETE CASCADE,
    consumable_id UUID,
    consumable_name TEXT NOT NULL,
    purchase_cost NUMERIC(14, 2) NOT NULL,
    yield_quantity NUMERIC(14, 4) NOT NULL,
    unit TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consumable_prices_snapshot
    ON consumable_prices (snapshot_id);

CREATE TABLE IF NOT EXISTS procedure_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id UUID NOT NULL REFERENCES month_snapshots (id) ON DELETE CASCADE,
    procedure_definition_id UUID NOT NULL REFERENCES procedure_definitions (id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    sale_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
    total_minutes INTEGER NOT NULL,
    equipment_minutes INTEGER,
    fixed_cost_template_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (snapshot_id, procedure_definition_id, label)
);

CREATE INDEX IF NOT EXISTS idx_procedure_variants_snapshot
    ON procedure_variants (snapshot_id);

CREATE TABLE IF NOT EXISTS procedure_staff_mix (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    procedure_variant_id UUID NOT NULL REFERENCES procedure_variants (id) ON DELETE CASCADE,
    role_id UUID,
    role_name TEXT NOT NULL,
    participants INTEGER NOT NULL DEFAULT 1,
    minutes INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS procedure_consumable_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    procedure_variant_id UUID NOT NULL REFERENCES procedure_variants (id) ON DELETE CASCADE,
    consumable_id UUID,
    consumable_name TEXT NOT NULL,
    quantity NUMERIC(14, 4) NOT NULL,
    unit TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS procedure_equipment_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    procedure_variant_id UUID NOT NULL REFERENCES procedure_variants (id) ON DELETE CASCADE,
    fixed_cost_template_id UUID NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (procedure_variant_id, fixed_cost_template_id)
);

CREATE TABLE IF NOT EXISTS procedure_cost_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id UUID NOT NULL REFERENCES month_snapshots (id) ON DELETE CASCADE,
    procedure_variant_id UUID NOT NULL REFERENCES procedure_variants (id) ON DELETE CASCADE,
    sale_price NUMERIC(14, 2) NOT NULL,
    case_count INTEGER NOT NULL DEFAULT 0,
    total_cost NUMERIC(14, 2) NOT NULL,
    margin NUMERIC(14, 2) NOT NULL,
    margin_rate NUMERIC(9, 6) NOT NULL,
    margin_per_minute NUMERIC(14, 6),
    cost_breakdown JSONB NOT NULL DEFAULT '{}'::JSONB,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (snapshot_id, procedure_variant_id)
);

CREATE INDEX IF NOT EXISTS idx_procedure_cost_results_snapshot
    ON procedure_cost_results (snapshot_id);

CREATE TABLE IF NOT EXISTS procedure_performance_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id UUID NOT NULL REFERENCES month_snapshots (id) ON DELETE CASCADE,
    procedure_variant_id UUID NOT NULL REFERENCES procedure_variants (id) ON DELETE CASCADE,
    total_cases INTEGER NOT NULL DEFAULT 0,
    total_revenue NUMERIC(14, 2) NOT NULL DEFAULT 0,
    total_cost NUMERIC(14, 2) NOT NULL DEFAULT 0,
    total_margin NUMERIC(14, 2) NOT NULL DEFAULT 0,
    total_minutes NUMERIC(14, 2) NOT NULL DEFAULT 0,
    avg_margin_rate NUMERIC(9, 6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (snapshot_id, procedure_variant_id)
);

CREATE INDEX IF NOT EXISTS idx_procedure_performance_summaries_snapshot
    ON procedure_performance_summaries (snapshot_id);

CREATE TABLE IF NOT EXISTS month_insight_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id UUID NOT NULL REFERENCES month_snapshots (id) ON DELETE CASCADE,
    top_procedure_by_volume UUID,
    top_procedure_by_margin UUID,
    lowest_margin_rate_procedure UUID,
    mom_volume_change JSONB NOT NULL DEFAULT '{}'::JSONB,
    mom_margin_change JSONB NOT NULL DEFAULT '{}'::JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (snapshot_id)
);

CREATE INDEX IF NOT EXISTS idx_month_insight_summaries_snapshot
    ON month_insight_summaries (snapshot_id);

COMMIT;

-- rollback:
-- BEGIN;
--   DROP TABLE IF EXISTS month_insight_summaries;
--   DROP TABLE IF EXISTS procedure_performance_summaries;
--   DROP TABLE IF EXISTS procedure_cost_results;
--   DROP TABLE IF EXISTS procedure_equipment_links;
--   DROP TABLE IF EXISTS procedure_consumable_usage;
--   DROP TABLE IF EXISTS procedure_staff_mix;
--   DROP TABLE IF EXISTS procedure_variants;
--   DROP TABLE IF EXISTS consumable_prices;
--   DROP TABLE IF EXISTS staff_capacities;
--   DROP TABLE IF EXISTS procedure_definitions;
--   DROP TABLE IF EXISTS snapshot_fixed_cost_links;
--   DROP TABLE IF EXISTS month_snapshots;
-- COMMIT;
