# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack) monorepo: a TypeScript full-stack project with a React SPA frontend, Hono backend, shared UI package, and Drizzle/SQLite database layer. It uses `vite-plus` (`vp`) as the unified task runner, formatter, and linter.

- **Frontend**: `apps/web` — React 19 + TanStack Router (file-based routing) + Tailwind CSS v4 + shadcn/ui.
- **Backend**: `apps/server` — Hono on Node.js via `@hono/node-server`.
- **Database**: `packages/db` — Drizzle ORM with libSQL/Turso dialect, SQLite file DB in development.
- **Shared packages**: `packages/ui` (shadcn/ui primitives and global styles), `packages/env` (T3-style env validation), `packages/config` (shared TypeScript config).

## Common Commands

All commands should be run from the repository root unless noted.

### Development

```bash
pnpm install
pnpm run dev            # Start web (localhost:5173) and server (localhost:3000)
pnpm run dev:web        # Start only the web app
pnpm run dev:server     # Start only the Hono server
```

The web dev server runs on port `3001` by default (`apps/web/vite.config.ts`), and the server runs on port `3000`.

### Database

Database commands are proxied to the `@shuaibin-cookie-app/db` package:

```bash
pnpm run db:local       # Start local libSQL/Turso dev server
pnpm run db:push        # Push schema changes to the database
pnpm run db:generate    # Generate Drizzle migrations
pnpm run db:migrate     # Run Drizzle migrations
pnpm run db:studio      # Open Drizzle Studio
```

Development DB connection is configured in `apps/server/.env`:

```env
DATABASE_URL=file:../../local.db
CORS_ORIGIN=http://localhost:3001
```

### Build

```bash
pnpm run build          # Build all apps/packages
```

- `apps/web` builds with `vp build`.
- `apps/server` builds with `tsdown` to `dist/index.mjs`; start with `pnpm --filter server start`.

### Lint, Format, and Type Check

```bash
pnpm run check          # Run Vite+ check + workspace type checks
pnpm run check-types    # Run TypeScript type checks across all packages
pnpm run lint           # Run Vite+ lint
pnpm run format         # Run Vite+ formatting
pnpm run staged         # Run Vite+ checks against staged files
```

Vite+ config is in `vite.config.ts`. It ignores generated files (`routeTree.gen.ts`, `dist/`, `local.db*`) and uses double quotes, semicolons, and sorted `package.json`.

### Git Hooks

```bash
pnpm run hooks:setup    # Install Vite+ native Git hooks (vp config)
```

## Workspace and Package Layout

This is a pnpm workspace (`pnpm-workspace.yaml`) with package-level scripts invoked through `vp run --filter <name>` or root aliases.

| Package/App | Name | Key paths |
|-------------|------|-----------|
| `apps/web` | `web` | `src/main.tsx`, `src/routes/` (file-based TanStack Router), `src/components/`, `index.html` |
| `apps/server` | `server` | `src/index.ts` (Hono app + `serve`) |
| `packages/db` | `@shuaibin-cookie-app/db` | `src/index.ts` (client + `createDb`), `src/schema/`, `src/migrations/`, `drizzle.config.ts` |
| `packages/ui` | `@shuaibin-cookie-app/ui` | `src/components/`, `src/styles/globals.css`, `src/lib/utils.ts`, `components.json` |
| `packages/env` | `@shuaibin-cookie-app/env` | `src/server.ts`, `src/web.ts` (Zod env schemas via `@t3-oss/env-core`) |
| `packages/config` | `@shuaibin-cookie-app/config` | `tsconfig.base.json` |

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

- Server env is validated in `packages/env/src/server.ts` and loaded from `apps/server/.env`.
- Web env is validated in `packages/env/src/web.ts` and expects `VITE_SERVER_URL` (set in `apps/web/.env`).
- Use `SKIP_ENV_VALIDATION` to bypass validation if needed.

### Database Layer

- `packages/db/src/index.ts` creates a libSQL client and Drizzle instance using `DATABASE_URL`.
- Schema is defined in `packages/db/src/schema/` and exported as a single namespace.
- `drizzle.config.ts` loads `apps/server/.env` and uses the `turso` dialect.

### Hono Server

`apps/server/src/index.ts` constructs a Hono app, applies `logger()` and CORS (using `env.CORS_ORIGIN`), defines routes, and serves via `@hono/node-server` on port 3000.

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
- No test framework is currently configured in the workspace packages.
