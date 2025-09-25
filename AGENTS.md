# Repository Guidelines

## Project Structure & Module Organization
This Vite-powered React application keeps runtime code in `src/`. Feature components sit under `src/components/`, page views in `src/pages/`, shared layouts in `src/layouts/`, and hooks in `src/hooks/`. Global state providers belong in `src/contexts/`, and reusable services live in `src/services/`. Shared domain types should be declared in `src/types.ts`. Build artifacts compile into `dist/`; never edit generated files. The root `index.html` bootstraps the client, and `.env.local` stores local-only environment variables such as `GEMINI_API_KEY`.

## Build, Test, and Development Commands
- `npm install` installs workspace dependencies; run after cloning or updating packages.
- `npm run dev` launches the Vite dev server at `http://localhost:3000` with hot reloading.
- `npm run build` performs TypeScript checks and outputs the production bundle to `dist/`.
- `npm run preview` serves the latest build for release verification.

## Coding Style & Naming Conventions
Write all runtime code in TypeScript using functional React components and hooks. Follow two-space indentation and prefer single quotes in source files; JSON files keep double quotes. Name components in PascalCase (`SettingsPage.tsx`), hooks with a `use` prefix (`useAccountBalance`), and singleton services in PascalCase (`DatabaseService`). Keep side effects inside services or dedicated hooks.

## Testing Guidelines
Automated tests are not yet configured. When adding coverage, colocate files as `ComponentName.test.tsx` beside the source and document the command required to run them. Before releases, run `npm run build` followed by `npm run preview` to manually verify user flows against the production bundle.

## Commit & Pull Request Guidelines
Commit messages should be short, imperative verbs (`Add tenant template defaults`) and scoped to a single concern. Pull requests must summarize changes, list validation commands, attach screenshots or GIFs for UI updates, and link related issues. Update `README.md`, `AGENTS.md`, or configuration notes whenever workflows, environment variables, or scripts change.

## Security & Configuration Tips
Never commit secrets; keep API keys inside `.env.local` and share via secure channels. When altering data workflows such as `DatabaseService` or tenant template defaults, verify migrations preserve tenant data and rerun `npm run build` to confirm the bundle still compiles.
