# Repository Guidelines

## Project Structure & Module Organization
This Vite-powered React app stores all runtime code in `src/`, with feature components under `components/`, state providers in `contexts/`, page-level views in `pages/`, hooks in `hooks/`, and reusable layouts and services in their namesake folders. Shared domain types belong in `src/types.ts`. Build artefacts publish to `dist/`; never edit files there. The root `index.html` bootstraps the client, and `.env.local` records required environment variables for local work.

## Build, Test, and Development Commands
- `npm install` - install workspace dependencies before the first run or when packages change.
- `npm run dev` - launch the Vite dev server on http://localhost:3000 with hot module reload.
- `npm run build` - run TypeScript checks and create an optimized bundle inside `dist/`.
- `npm run preview` - serve the latest production build to verify release-ready behaviour.

## Coding Style & Naming Conventions
Use TypeScript throughout; prefer functional React components and hooks over classes. Follow the existing formatting: two-space indentation, single quotes in source files, and double quotes in JSON. Name components with PascalCase (e.g., `SettingsPage.tsx`), hooks with a `use`-prefixed camelCase name, and singleton services in PascalCase (e.g., `DatabaseService`). Leverage TypeScript types for API surfaces and keep side effects inside services or dedicated hooks.

## Testing Guidelines
Automated tests are not yet configured. When adding tests, colocate them beside the source file as `ComponentName.test.tsx` and document the command needed to execute them. For manual QA before a release, run `npm run build` to ensure type safety and bundling succeed, then `npm run preview` to verify user flows against the production bundle.

## Commit & Pull Request Guidelines
Write focused, imperative commit messages such as `Add tenant template defaults`. Each change should target a single concern. Pull requests must include a succinct summary, commands executed for validation, screenshots or GIFs for UI updates, and links to related issues. Update docs - `README.md`, `AGENTS.md`, or configuration notes - whenever workflows, environment variables, or scripts change.

## Security & Configuration Tips
Keep API keys and secrets (e.g., `GEMINI_API_KEY`) inside `.env.local`; do not commit that file. When touching data workflows such as `DatabaseService` or template defaults, ensure migrations preserve tenant data and rerun `npm run build` afterward to validate the bundle.
