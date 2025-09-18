# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React-based financial dashboard application for healthcare facilities (hospitals and clinics) to manage income statements and financial data. Built with TypeScript, React 19 RC, and Vite. The application features multi-tenancy support, centralized template management, and comprehensive financial tracking for Korean healthcare businesses.

## Development Commands

### Core Commands
- `npm install` - Install dependencies
- `npm run dev` - Start development server (runs on port 3000)
- `npm run build` - Build for production (TypeScript compilation + Vite build)
- `npm run preview` - Preview production build

### Environment Setup
- Set `GEMINI_API_KEY` in `.env.local` for AI features (optional)
- Development server runs on `http://localhost:3000`

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

### State Management Pattern
The application uses React Context + custom hooks pattern:
- `FinancialDataProvider` wraps the entire app
- `useFinancialData` hook encapsulates all business logic
- `useFinancials` hook provides access to context data
- Current months selection managed separately for UI state

### Core Data Types
- **Account** - Financial account with category (REVENUE, COGS, SGA_FIXED, SGA_VARIABLE)
- **Transaction** - Individual transaction records
- **FixedCostLedgerItem** - Fixed cost tracking with asset vs operating service distinction
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
- Account categorization (Revenue, COGS, SGA Fixed/Variable)
- Manual data entry and transaction-based tracking
- Fixed cost ledger with asset finance vs operating service distinction
- Monthly data aggregation and calculations

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

- **Frontend**: React 19 RC with TypeScript
- **Build Tool**: Vite with React plugin
- **Routing**: React Router DOM v6
- **Charts**: Recharts for data visualization
- **Styling**: Tailwind CSS (based on className usage patterns)
- **Path Aliases**: `@/*` maps to root directory

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
- Account management: `addAccount`, `removeAccount`, `updateAccount`
- Transaction operations: `addTransaction`, `removeTransaction`, `updateTransaction`
- Manual data: `updateManualAccountValue`
- Fixed costs: `addFixedCostLedgerItem`, `updateFixedCostLedgerItem`, `removeFixedCostLedgerItem`

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