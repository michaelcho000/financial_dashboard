# Repository Guidelines

## Project Structure & Module Organization
- `src/` holds runtime TypeScript. UI atoms live in `src/components/`, page views in `src/pages/`, layout wrappers in `src/layouts/`, hooks in `src/hooks/`, context providers in `src/contexts/`, and shared services in `src/services/`.
- Shared types stay in `src/types.ts`; update it whenever new domain models are added.
- `docs/` contains supporting specs and financial references; `db/` stores seed data and migration helpers. Keep generated bundles inside `dist/` only.
- Global styles live in `index.css`; `index.html` bootstraps Vite. Stash secrets in `.env.local` (e.g., `GEMINI_API_KEY`).

## Build, Test, and Development Commands
- `npm install` — synchronize dependencies after cloning or switching branches.
- `npm run dev` — start the Vite dev server on `http://localhost:3000` with HMR.
- `npm run build` — run TypeScript checks and emit production assets to `dist/`.
- `npm run preview` — serve the latest build for acceptance walkthroughs.

## Coding Style & Naming Conventions
Use TypeScript with functional React components, two-space indentation, and single quotes; JSON stays double-quoted. Components use PascalCase (`CashFlowTable.tsx`), hooks use `use` prefixes (`useLedgerSummary`), and services use PascalCase singletons. Co-locate module-specific assets beside their component; shared utilities belong in `src/services/`.

## Testing Guidelines
Test tooling is not bundled yet. When introducing tests, colocate them as `ComponentName.test.tsx` next to the source, document the run command in the PR, and rely on `npm run build` plus `npm run preview` for manual regression coverage until an automated suite is added.

## Commit & Pull Request Guidelines
Write imperative, single-focus commit messages (e.g., `Add cash flow importer`). Pull requests should summarize intent, list validation steps, link issues, and attach UI captures when screens change. Update `README.md`, `AGENTS.md`, or related docs whenever workflows, environment variables, or scripts evolve.

## Security & Configuration Tips
Do not commit `.env.local` or spreadsheets containing private ledger data. Validate schema or migration scripts in `db/` before merging, and rerun `npm run build` afterward to ensure the bundle stays green.
