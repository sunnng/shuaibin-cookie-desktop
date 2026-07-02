# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack) monorepo: a TypeScript full-stack project with a React SPA frontend, Hono backend, shared UI package, and Drizzle/SQLite database layer. It uses `vite-plus` (`vp`) as the unified task runner, formatter, and linter.

- **Frontend**: `apps/web` — React 19 + TanStack Router (file-based routing) + Tailwind CSS v4 + shadcn/ui.
- **Backend**: `apps/server` — Hono on Node.js via `@hono/node-server`.
- **Database**: `packages/db` — Drizzle ORM with libSQL/Turso dialect, SQLite file DB in development.
- **Shared packages**: `packages/ui` (shadcn/ui primitives and global styles), `packages/env` (T3-style env validation), `packages/config` (shared TypeScript config).
- **Desktop**: `apps/desktop` — Electron app embedding the Hono backend and a Vite+React renderer; packaged with electron-builder.

## Common Commands

All commands should be run from the repository root unless noted.

### Development

```bash
pnpm install
pnpm run dev            # Start web (localhost:3001) and server (localhost:3000)
pnpm run dev:web        # Start only the web app
pnpm run dev:server     # Start only the Hono server
```

The web dev server runs on port `3001` (`apps/web/vite.config.ts`), and the server runs on port `3000`.

### Desktop

Desktop scripts first build the `server` package so the Electron main process can import the Hono app.

```bash
pnpm run dev:desktop       # Build server, then start Electron in dev mode
pnpm run build:desktop     # Build server, then build desktop production artifacts
pnpm run dist:desktop      # Build server, then build Windows installer and portable zip
pnpm run compile:desktop   # Build server, then build with default electron-builder target
```

The desktop dev renderer server runs on port `5174` and the embedded Hono server on port `3002`.

### Database

Database commands are proxied to the `@shuaibin-cookie-app/db` package:

```bash
pnpm run db:local       # Start local libSQL/Turso dev server
pnpm run db:push        # Push schema changes to the database
pnpm run db:generate    # Generate Drizzle migrations
pnpm run db:migrate     # Run Drizzle migrations
pnpm run db:studio      # Open Drizzle Studio
```

### Build

```bash
pnpm run build          # Build all apps/packages
```

- `apps/web` builds with `vp build` to `apps/web/dist`.
- `apps/server` builds with `tsdown` to `dist/index.mjs` (the Hono app) and `dist/start.mjs` (the standalone entry point); start with `pnpm --filter server start`.
- `apps/desktop` builds main/preload/renderer to `apps/desktop/out` and electron-builder output lands in `apps/desktop/dist`.

### Lint, Format, and Type Check

```bash
pnpm run check          # Run Vite+ check + workspace type checks
pnpm run check-types    # Run TypeScript type checks across all packages
pnpm run lint           # Run Vite+ lint
pnpm run format         # Run Vite+ formatting
pnpm run staged         # Run Vite+ checks against staged files
```

Vite+ config is in `vite.config.ts`. It ignores generated files (`routeTree.gen.ts`, `dist/`, `local.db*`) and uses double quotes, semicolons, and sorted `package.json`.

### Tests

No test framework is currently configured in the workspace packages. `vite.config.ts` overrides `vitest` to `@voidzero-dev/vite-plus-test@0.1.24`, so tests can be added via Vite+/Vitest when needed.

### Git Hooks

```bash
pnpm run hooks:setup    # Install Vite+ native Git hooks (vp config)
```

## Workspace and Package Layout

This is a pnpm workspace (`pnpm-workspace.yaml`) with package-level scripts invoked through `vp run --filter <name>` or root aliases.

| Package/App       | Name                          | Key paths                                                                                       |
| ----------------- | ----------------------------- | ----------------------------------------------------------------------------------------------- |
| `apps/desktop`    | `desktop`                     | `src/main/index.ts`, `src/renderer/main.tsx`, `electron.vite.config.ts`, `electron-builder.yml` |
| `apps/web`        | `web`                         | `src/main.tsx`, `src/routes/` (file-based TanStack Router), `src/components/`, `index.html`     |
| `apps/server`     | `server`                      | `src/index.ts` (Hono app), `src/start.ts` (standalone server entry)                             |
| `packages/db`     | `@shuaibin-cookie-app/db`     | `src/index.ts` (client + `createDb`), `src/schema/`, `src/migrations/`, `drizzle.config.ts`     |
| `packages/ui`     | `@shuaibin-cookie-app/ui`     | `src/components/`, `src/styles/globals.css`, `src/lib/utils.ts`, `components.json`              |
| `packages/env`    | `@shuaibin-cookie-app/env`    | `src/server.ts`, `src/web.ts` (Zod env schemas via `@t3-oss/env-core`)                          |
| `packages/config` | `@shuaibin-cookie-app/config` | `tsconfig.base.json`                                                                            |

## High-Level Architecture

### Routing

`apps/web` uses TanStack Router with file-based route generation. Routes live in `apps/web/src/routes/`:

- `__root.tsx` — root layout (`ThemeProvider`, `Header`, `Toaster`, devtools).
- `index.tsx` — home route (`/`).

`@tanstack/router-plugin/vite` generates `src/routeTree.gen.ts` automatically; this file is gitignored.

### Shared UI and Styling

- Shared shadcn/ui components live in `packages/ui/src/components/` and are imported as `@shuaibin-cookie-app/ui/components/<name>`.
- Global Tailwind v4 styles and CSS variables live in `packages/ui/src/styles/globals.css`.
- `apps/web/src/index.css` imports `@shuaibin-cookie-app/ui/globals.css`.
- Both `packages/ui/components.json` and `apps/web/components.json` are configured for the `base-lyra` style, non-RSC, Tailwind v4, and `lucide-react` icons.

To add new shared primitives, run shadcn from the workspace root targeting `packages/ui`:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

### Environment Variables

- Server env is validated in `packages/env/src/server.ts` and loaded from `apps/server/.env`:
  - `DATABASE_URL=file:../../local.db`
  - `CORS_ORIGIN=http://localhost:3001`
- Web env is validated in `packages/env/src/web.ts` and expects `VITE_SERVER_URL` (set in `apps/web/.env` to `http://localhost:3000`).
- Desktop env loads `apps/server/.env` in development (via `apps/desktop/src/main/env.ts`) and uses `apps/desktop/.env` for the renderer's `VITE_SERVER_URL` (`http://localhost:3002`). In production the packaged app loads `resources/.env` and sets `CORS_ORIGIN=*` because the renderer loads from `file://`.
- Use `SKIP_ENV_VALIDATION` to bypass validation if needed.

### Database Layer

- `packages/db/src/index.ts` creates a libSQL client and Drizzle instance using `DATABASE_URL`.
- `createDb()` returns a fresh Drizzle client; a default `db` export is also provided.
- Schema is defined in `packages/db/src/schema/` and exported as a single namespace; the schema is currently empty.
- `drizzle.config.ts` loads `apps/server/.env` and uses the `turso` dialect.

### Hono Server

`apps/server/src/index.ts` constructs a Hono app, applies `logger()` and CORS (using `env.CORS_ORIGIN`), defines routes, and exports the app. `apps/server/src/start.ts` is the standalone Node.js entry point that serves the app on port 3000. The desktop app imports the same Hono app and starts it on its own embedded server (`apps/desktop/src/main/server.ts`).

### Desktop App

The desktop app has three Electron-Vite targets:

- **Main**: `apps/desktop/src/main/index.ts` — creates the `BrowserWindow`, loads `server` as a workspace dependency, starts the embedded Hono server, registers IPC handlers, tray, and auto-updater.
- **Preload**: `apps/desktop/src/preload/index.ts` — exposes a typed `electronAPI` via `contextBridge`, including `getServerPort`, file dialogs, notifications, and `minimizeToTray`.
- **Renderer**: `apps/desktop/src/renderer/main.tsx` — a small Vite+React app that talks to the embedded server through `api.ts` and uses shared UI components.

In development the renderer loads from `http://localhost:5174`; in production it loads `out/renderer/index.html`. The embedded server picks an available port starting at `3002` in development and `3001` in production.

### Import Paths

- Apps use `@/` to alias their own `src/` directory (configured per-package in `tsconfig.json`).
- Shared UI is imported as `@shuaibin-cookie-app/ui/*`.
- The server app imports `@shuaibin-cookie-app/db` and `@shuaibin-cookie-app/env/server`.

## MCP Servers and Agent Skills

The project includes MCP server configs in `.mcp.json`, `.cursor/mcp.json`, and `.vscode/mcp.json`:

- `better-t-stack` — Better-T-Stack CLI MCP.
- `context7` — Upstash Context7 docs MCP.
- `shadcn` — shadcn/ui CLI MCP.

Agent skills are vendored under `.agents/skills/` (hono, shadcn, web-design-guidelines) and tracked in `skills-lock.json`.

## Important Notes

- Use `pnpm` (version 11.9.0) as the package manager.
- Root scripts use `vp` (Vite+) for task running, linting, and formatting.
- TypeScript base config enforces strict mode, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, and unused-local/parameter checks.
- `vite.config.ts` disables type-aware linting (`typeAware: false`, `typeCheck: false`); rely on `check-types` for type checking.
