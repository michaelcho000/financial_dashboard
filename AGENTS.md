# Repository Guidelines

## Project Structure & Module Organization
- src/ holds all TypeScript/React code. Key subfolders include components/, contexts/, layouts/, pages/, services/, and hooks/; shared types live in src/types.ts.
- index.html at the repo root is the Vite entry point; build artefacts output to dist/.
- .env.local documents required environment keys; do not commit secrets.

## Build, Test, and Development Commands
- 
pm install ? install workspace dependencies.
- 
pm run dev ? start the Vite dev server on port 3000 for local previewing.
- 
pm run build ? run TypeScript checks and create a production bundle in dist/.
- 
pm run preview ? serve the latest production build locally.

## Coding Style & Naming Conventions
- Use functional React components with hooks; files are written in TypeScript (TS/TSX).
- Follow existing formatting: 2-space indentation, single quotes in source, double quotes in JSON.
- Components use PascalCase filenames (e.g., SettingsPage.tsx); hooks use camelCase with a use prefix; singleton services use PascalCase (e.g., DatabaseService).

## Testing Guidelines
- Automated tests are not configured. If you add tests, co-locate them beside the source (ComponentName.test.tsx) and document the command to run them.
- For manual QA run 
pm run build followed by 
pm run preview to verify production output.

## Commit & Pull Request Guidelines
- Write imperative, descriptive commit messages (Add tenant template defaults). Keep each commit focused.
- Pull requests should include a concise summary, testing evidence (commands run), affected UI screenshots/GIFs when relevant, and linked issue IDs.
- Update docs (README.md, AGENTS.md, configuration notes) whenever build steps, environment variables, or developer workflows change.

## Security & Configuration Tips
- Store API keys (e.g., GEMINI_API_KEY) in .env.local; never commit secrets.
- When modifying DatabaseService or settings templates, ensure migrations preserve existing tenant data and validate with a fresh 
pm run build.
