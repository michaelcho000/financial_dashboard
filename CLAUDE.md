# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React-based financial dashboard application for small businesses to manage income statements. Built with TypeScript, React 19 RC, and Vite. The application tracks revenue, cost of goods sold (COGS), and operating expenses with features for account management and monthly financial data analysis.

## Development Commands

### Core Commands
- `npm install` - Install dependencies
- `npm run dev` - Start development server (runs on port 3000)
- `npm run build` - Build for production (TypeScript compilation + Vite build)
- `npm run preview` - Preview production build

### Environment Setup
- Set `GEMINI_API_KEY` in `.env.local` for AI features
- Development server runs on `http://localhost:3000`

## Architecture Overview

### Application Structure
The application follows a component-based React architecture with centralized state management:

- **App.tsx** - Main application component with React Router setup
- **Context Layer** - `FinancialDataProvider` manages all financial data state
- **Hook Layer** - `useFinancialData` handles business logic and data operations
- **Component Layer** - Page components, charts, tables, and UI elements

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
- `/dashboard` - Main dashboard with financial overview
- `/income-statement` - Detailed income statement view
- `/fixed-costs` - Fixed cost management page
- `/account-management` - Account configuration and management

## Key Features

### Financial Data Management
- Account categorization (Revenue, COGS, SGA Fixed/Variable)
- Manual data entry and transaction-based tracking
- Fixed cost ledger with asset finance vs operating service distinction
- Monthly data aggregation and calculations

### Multi-tenancy Support
Basic user and tenant management structure in place (see `User` and `Tenant` interfaces in types.ts).

### Data Flow
1. Data entered through UI components
2. State updates flow through context providers
3. Business logic handled in custom hooks
4. Calculated metrics generated automatically
5. Charts and tables display processed data

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

### Korean Language Support
The application includes Korean text and supports Korean business terminology (e.g., '인건비' for personnel expenses, '계정 관리' for account management).