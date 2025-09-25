# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React-based financial dashboard application for healthcare facilities (hospitals and clinics) to manage income statements and financial data. Built with TypeScript, React 18, and Vite. The application features multi-tenancy support, centralized template management, and comprehensive financial tracking for Korean healthcare businesses.

## Development Commands

### Core Commands
- `npm install` - Install dependencies
- `npm run dev` - Start development server (runs on port 3000)
- `npm run build` - Build for production (TypeScript compilation + Vite build)
- `npm run preview` - Preview production build

### Environment Setup
- Set `GEMINI_API_KEY` in `.env.local` for AI features (optional)
- Set `VITE_FEATURE_COSTING_MODULE=true/false` to enable/disable costing module
- Set `VITE_COSTING_BACKEND=local/supabase` to configure costing backend
- Development server runs on `http://localhost:3000` (configured in vite.config.ts)

### Authentication
- **Super Admin**: `superadmin` / `adminpass` - Full system access
- **General Admin**: `user1` / `userpass` - Hospital-specific access (assigned to 'tenant-1')

## Architecture Overview

### Application Structure
The application follows a component-based React architecture with multi-tenancy and template management:

- **App.tsx** - Main application with nested routing for admin/staff roles
- **DatabaseService** - LocalStorage-based data layer with tenant isolation
- **Template System** - Centralized account template management for new hospitals
- **Context Layer** - `AuthProvider` (user/tenant) + `FinancialDataProvider` (financial data)
- **Hook Layer** - `useAuth`, `useFinancialData` for business logic
- **Component Layer** - Role-based page components and shared UI elements

### Key Directories
- `components/` - All React components organized by feature
  - Page components: `DashboardPage`, `IncomeStatementPage`, `FixedCostsPage`, `AccountManagementPage`
  - Charts: `MonthlyTrendChart` for data visualization
  - Tables: Income statement and transaction tables
  - UI: Common UI components and icons
- `contexts/` - React Context providers for state management
- `hooks/` - Custom React hooks for business logic
- `types.ts` - TypeScript type definitions for the entire application
- `utils/` - Utility functions and helpers
- `services/` - Database service layer

### State Management Pattern
The application uses React Context + custom hooks pattern:
- `FinancialDataProvider` wraps the entire app
- `useFinancialData` hook encapsulates all business logic
- `useFinancials` hook provides access to context data
- Current months selection managed separately for UI state

### Core Data Types
- **Account** - Financial account with category (REVENUE, EXPENSE)
  - `costBehavior?: 'fixed' | 'variable'` - Only for expense accounts
  - `isTemporary?: boolean` - Marks accounts added for specific months only
  - `isArchived?: boolean` - Preserves deleted accounts with existing data
- **Transaction** - Individual transaction records
- **FixedCostTemplate** - Fixed cost tracking with asset vs operating service distinction
- **FixedCostActual** - Monthly fixed cost amounts and active status
- **MonthlyAccountOverrides** - Month-specific account additions and modifications
- **TransactionData & ManualData** - Monthly transaction and manual entry storage
- **CalculatedMonthData** - Computed financial metrics per month

### Routing Structure
**Admin Routes** (Super Admin only):
- `/admin/dashboard` - System overview and hospital management
- `/admin/tenants` - Hospital management (add/edit/delete hospitals)
- `/admin/users` - User management and role assignment
- `/admin/settings` - **System settings and data template management**

**Staff Routes** (General Admin + Super Admin in hospital mode):
- `/dashboard` - Financial dashboard for selected hospital
- `/income-statement` - Detailed income statement view
- `/fixed-costs` - Fixed cost management page
- `/costing/*` - Procedure costing module (feature flag controlled)
- `/account-management` - Account configuration for selected hospital
- `/reports` - Monthly financial reports

### Data Template System
**Core Concept**: Centralized template management for consistent hospital initialization.

**Key Components**:
- `SystemSettings.tenantTemplate` - Master template for new hospitals
- `DataTemplateEditor` - UI for editing account templates (in `/admin/settings`)
- Template versioning system prevents data corruption during updates
- `DatabaseService.createFinancialsFromTemplate()` - Applies template to new hospitals

**Template Structure**:
- **Account Groups**: Revenue (비급여/보험/기타), COGS (시술원가/직접인건비/외주검사), SGA (인건비/임차관리/마케팅운영/기타)
- **Representative Accounts**: Generic accounts that hospitals can extend with specific sub-accounts
- **Fixed Cost Items**: Default operating expenses and asset financing templates

## Key Features

### Financial Data Management
- Account categorization (Revenue, Expense with variable/fixed cost behavior)
- Manual data entry and transaction-based tracking
- Fixed cost management with asset finance vs operating service distinction
- Monthly data aggregation and calculations
- **Monthly Account Overrides**: Add temporary accounts for specific months without affecting base structure
- **Account Archiving**: Preserve data for deleted accounts while hiding them from active use
- **Draft System**: Account Management page uses draft/save pattern for batch updates

### Multi-tenancy Architecture
**Hospital Isolation**: Each hospital (tenant) has completely isolated financial data.

**User Roles**:
- **Super Admin**: System-wide access, can manage all hospitals and system settings
- **General Admin**: Hospital-specific access, assigned to specific tenants

**Data Isolation**: `DatabaseService` maintains separate `financialData[tenantId]` for each hospital.

### Template Management Workflow
1. **Super Admin** edits master template via `/admin/settings`
2. **Template changes** apply only to newly created hospitals
3. **Existing hospitals** maintain their customized account structures
4. **Safe migration** system preserves hospital data during template updates

### Data Flow
1. **Template Definition**: Super Admin defines representative accounts in system settings
2. **Hospital Creation**: New hospitals initialized with current template
3. **Hospital Customization**: Each hospital adds specific sub-accounts as needed
4. **Data Entry**: Staff enters transactions/manual data through hospital-specific UI
5. **Calculations**: Automated monthly financial metrics and reporting

## Technology Stack

- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite with React plugin
- **Routing**: React Router DOM v6
- **Charts**: Recharts for data visualization
- **Styling**: Tailwind CSS (based on className usage patterns)
- **Path Aliases**: `@/*` maps to root directory
- **State Persistence**: LocalStorage-based database
- **Feature Flags**: Environment-based feature toggles for module enablement
- **Icons**: Custom SVG icon components (Lucide React)

## Development Notes

### TypeScript Configuration
- Target: ES2022 with experimental decorators
- Module resolution: bundler mode with import extensions allowed
- JSX: react-jsx transform
- Path mapping: `@/*` points to project root

### Import Patterns
- Relative imports from same directory level
- Absolute imports using `@/` prefix for root-level imports
- Component imports organized by feature area

### State Update Patterns
All financial data mutations flow through the `useFinancialData` hook methods:

**Base Account Management:**
- `addAccount`, `removeAccount`, `updateAccount` - Core account structure
- `saveStructure` - Batch save for Account Management page drafts

**Monthly Account Overrides:**
- `addMonthlyAccount`, `removeMonthlyAccount`, `updateMonthlyAccount` - Month-specific accounts

**Transaction Operations:**
- `addTransaction`, `removeTransaction`, `updateTransaction`
- `setTransactionAccountTotal` - Set total for transaction-based accounts

**Data Entry:**
- `updateManualAccountValue` - Manual data entry
- `upsertActual`, `removeActual` - Fixed cost monthly amounts

**Fixed Cost Templates:**
- `addTemplate`, `updateTemplate`, `removeTemplate` - Fixed cost template management
- `createAccount` - Create SGA_FIXED accounts for templates

### Template System Implementation
**DatabaseService Template Methods**:
- `getSettings()` - Retrieves system settings including master template
- `saveSettings(updates)` - Updates template with automatic versioning
- `createFinancialsFromTemplate(template)` - Generates hospital data from template
- `migrateTenantTemplate()` - Safe template updates preserving hospital data

**Version Management**:
- `DB_SCHEMA_VERSION` - Database structure version (major schema changes)
- `TEMPLATE_VERSION` - Template content version (account structure changes)
- Automatic migration ensures data integrity during template updates

### React Router v6 Nested Routing
**Important**: Child routes in nested layouts use relative paths:
- Admin routes: `path="dashboard"` not `path="/dashboard"` (resolves to `/admin/dashboard`)
- Staff routes: `path="dashboard"` not `path="/dashboard"` (resolves to `/dashboard`)
- Index routes: `path=""` for default redirects within nested layouts

### Korean Healthcare Business Context
The application supports Korean healthcare terminology and business practices:
- Account categories aligned with Korean medical practice accounting
- Revenue split between 비급여 (non-insurance) and 보험 (insurance) services
- Fixed costs include healthcare-specific items (의료장비, 4대보험료, etc.)
- Multi-hospital management for healthcare chains or management companies

## Important Implementation Notes

### Monthly Account Override System
**Purpose**: Allow month-specific account additions without modifying base account structure.

**Key Implementation Details:**
- `MonthlyAccountOverrides` stores temporary accounts per month
- Temporary accounts marked with `isTemporary: true`
- Base account deletions use archiving (`isArchived: true`) to preserve historical data
- `accountValues` calculation considers both base and temporary accounts
- UI shows "+ 해당 월 전용 항목 추가" button in Income Statement tables

### Account Management Draft System
**Purpose**: Prevent accidental changes by requiring explicit save action.

**Implementation:**
- `AccountManagementPage` maintains separate draft state
- `isDirty` flag tracks unsaved changes
- `saveStructure()` applies all changes atomically
- Archived accounts (`isArchived: true`) are filtered from active display

### Fixed Cost Template System
**Architecture**: Templates define the structure, Actuals store monthly values.

**Key Points:**
- `FixedCostTemplate` - Defines service details and default amounts
- `FixedCostActual` - Monthly amounts and active/inactive status
- Templates linked to SGA_FIXED accounts via `accountId`
- UI provides asset finance vs operating service categorization
- Payment date selection with day-of-month picker interface

### Data Migration System
**Purpose**: Safely upgrade data structures while preserving hospital customizations.

**Migration Strategy:**
- Schema version changes trigger full database migration
- Template version changes only affect new hospitals
- Existing hospital data preserved during migrations
- Backup system creates recovery points before migrations
- `runManualMigration()` available for Super Admin manual triggers

### LocalStorage Database Architecture
**Storage Keys:**
- `financial_app_db` - Main database
- `financial_app_db_schema_version` - Schema version tracking
- `financial_app_current_user` - Current user session
- `financial_app_active_tenant` - Selected hospital
- `superadmin_selected_hospital` - Super Admin's hospital selection

### Feature Flag System
**Configuration**: Feature flags are controlled via environment variables and managed in `src/config/featureFlags.ts`.

**Available Flags**:
- `VITE_FEATURE_COSTING_MODULE` - Enables/disables the procedure costing module
- `VITE_COSTING_BACKEND` - Configures backend for costing (local/supabase)

**Usage Pattern**:
- Flags are evaluated at build time and runtime
- Missing environment variables default to `true` for costing module
- Components conditionally render based on `featureFlags.costingModule`

**Implementation Example**:
```tsx
import { featureFlags } from './config/featureFlags';

{featureFlags.costingModule && (
    <Route path="costing/*" element={<CostingRouter />} />
)}
```

### Costing Module Architecture
**Purpose**: Procedure-based cost analysis and pricing calculations for healthcare services.

**Key Components**:
- `CostingRouter` - Nested routing for costing workflows
- `CostingLayout` - Specialized layout with header integration
- `CostingServicesContext` - Service layer abstraction
- `CostingBaselineContext` - Baseline data management

**Service Layers**:
- **Factory Pattern**: `services/costing/factory.ts` - Service instantiation
- **Local Storage**: `services/costing/local/` - Client-side persistence
- **Supabase Integration**: `services/costing/supabase/` - Cloud backend
- **HTTP Client**: `services/costing/client/httpClient.ts` - API communication

**Integration Points**:
- Header component includes costing navigation when enabled
- Month synchronization with main financial dashboard
- Isolated data contexts for costing-specific state management