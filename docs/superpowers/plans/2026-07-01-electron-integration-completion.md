# Electron Integration Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate, fix, document, and merge the existing `electron-integration` worktree into `main` so the Better-T-Stack monorepo ships with a working self-contained Electron desktop app.

**Architecture:** The Electron desktop app lives in `apps/desktop`. Its main process imports the Hono app from the built `apps/server` package, starts it on a dynamically discovered local port, and loads a Vite-built React renderer. The renderer accesses the embedded server and native APIs through a typed `contextBridge` preload script. Packaging uses `electron-vite` and `electron-builder`.

**Tech Stack:** Electron 34, electron-vite 3, electron-builder 26, Vite 6/8, React 19, TypeScript, Hono, pnpm workspaces.

## Global Constraints

- Keep `apps/web` untouched and functional in the browser.
- Security defaults: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`.
- The Hono server from `apps/server` runs inside the Electron main process, not as a separate CLI app.
- Production port discovery scans from `3001` upward; development uses fixed ports `3002` (embedded server) and `5174` (renderer dev server).
- Packaging targets Windows only in this phase (`nsis` installer + `zip` portable).
- Native dependencies must be rebuilt for Electron via `electron-builder install-app-deps`.
- All privileged renderer access flows through the preload script; no direct Node/Electron imports in renderer code.
- Use `pnpm@11.9.0` and `vp` (Vite+) for workspace scripts.
- Root `check-types`, `lint`, and `format` must pass before merging to `main`.

## File Structure

Existing files created or modified in the `electron-integration` worktree:

```
apps/desktop/
├── .env                                  # Dev env (VITE_SERVER_URL)
├── electron-builder.yml                  # Packaging configuration
├── electron.vite.config.ts               # electron-vite config
├── package.json                          # Desktop package scripts & deps
├── tsconfig.json                         # Desktop TypeScript config
└── src/
    ├── main/
    │   ├── index.ts                      # Main process bootstrap
    │   ├── server.ts                     # Embedded Hono server + port discovery
    │   ├── ipc-handlers.ts               # ipcMain handlers
    │   ├── tray.ts                       # System tray logic
    │   ├── updater.ts                    # Auto-updater stub
    │   └── env.ts                        # Environment loader
    ├── preload/
    │   ├── index.ts                      # contextBridge API exposure
    │   └── api.d.ts                      # Type declarations for window.electronAPI
    └── renderer/
        ├── index.html                    # Renderer HTML entry
        ├── main.tsx                      # React root
        ├── App.tsx                       # Desktop app shell
        └── api.ts                        # API client using electronAPI/server port

apps/server/
├── src/
│   ├── index.ts                          # Export configured Hono app
│   └── start.ts                          # Standalone server entry
└── package.json                          # Exports dist/index.mjs; dev/start use start.ts

package.json                              # Root shortcuts: dev:desktop, build:desktop, dist:desktop, compile:desktop
.gitignore                                # Ignore apps/desktop/out, dist, local.db*
pnpm-workspace.yaml                       # Add onlyBuiltDependencies for electron
```

Files to create or modify during completion:

- Modify: `CLAUDE.md` — add desktop app section and commands.
- Modify: `apps/desktop/src/main/index.ts` — only if verification reveals runtime issues.
- Modify: `apps/desktop/electron.vite.config.ts` — only if build issues are found.
- Modify: `apps/server/package.json` — only if workspace import resolution fails.

---

### Task 1: Verify development workflow

**Files:**

- No code changes expected; verification only.

**Interfaces:**

- Consumes: all desktop source files and `apps/server` build output.
- Produces: confirmation that `pnpm run dev:desktop` launches a working Electron window.

- [ ] **Step 1: Enter the `electron-integration` worktree**

If not already in the worktree directory, switch to it:

```bash
cd D:/dev/projects/shuaibin-cookie-app/.worktrees/electron-integration
```

- [ ] **Step 2: Ensure dependencies are installed**

```bash
pnpm install
```

Expected: installs complete without errors; `electron-builder install-app-deps` runs for `apps/desktop`.

- [ ] **Step 3: Start the desktop app in development mode**

```bash
pnpm run dev:desktop
```

Expected:

- `apps/server` builds to `dist/index.mjs`.
- Electron window opens.
- Renderer loads from `http://localhost:5174`.
- Embedded Hono server starts on port `3002` (dev fixed port).
- UI displays `OK` from `GET /`.
- DevTools opens automatically.

- [ ] **Step 4: Test native notification**

Click the **Show notification** button in the Electron window.

Expected: a native OS notification appears with title "Hello" and body "From desktop".

- [ ] **Step 5: Stop the desktop app**

Close the Electron window or press `Ctrl+C` in the terminal.

Expected: app exits cleanly; no orphaned Node/Electron processes remain.

- [ ] **Step 6: Record results**

If any step fails, create a follow-up Task 4 sub-task for the failure before proceeding.

---

### Task 2: Verify type checking and code quality

**Files:**

- No code changes expected; verification only.

**Interfaces:**

- Consumes: all workspace packages.
- Produces: confirmation that `check-types`, `lint`, and `format` pass.

- [ ] **Step 1: Run type checks across the workspace**

```bash
pnpm run check-types
```

Expected: TypeScript reports no errors for `apps/desktop`, `apps/server`, `apps/web`, or any package.

- [ ] **Step 2: Run lint**

```bash
pnpm run lint
```

Expected: `vp lint` reports no errors.

- [ ] **Step 3: Run format check**

```bash
pnpm run format
```

Expected: formatter completes; if it modifies files, stage and commit them.

- [ ] **Step 4: Record results**

If any step fails, create a follow-up Task 4 sub-task for the failure before proceeding.

---

### Task 3: Verify production build and packaging

**Files:**

- No code changes expected; verification only.

**Interfaces:**

- Consumes: all desktop source files and `apps/server` build output.
- Produces: `apps/desktop/out/` and `apps/desktop/dist/` artifacts.

- [ ] **Step 1: Build the desktop app**

```bash
pnpm run build:desktop
```

Expected:

- `apps/server` builds to `dist/index.mjs`.
- `apps/desktop/out/main/index.js` is created.
- `apps/desktop/out/preload/index.mjs` is created.
- `apps/desktop/out/renderer/index.html` and assets are created.
- No build errors.

- [ ] **Step 2: Package for Windows**

```bash
pnpm run dist:desktop
```

Expected:

- `apps/desktop/dist` contains:
  - `ShuaibinCookieApp Setup.exe` (NSIS installer)
  - `ShuaibinCookieApp-win32-x64.zip`
- No packaging errors.

- [ ] **Step 3: Run the packaged app**

Extract `apps/desktop/dist/ShuaibinCookieApp-win32-x64.zip` and run `ShuaibinCookieApp.exe`.

Expected:

- App window opens.
- Embedded server starts on a dynamically discovered port.
- Renderer loads the production build.
- UI displays `OK` from `GET /`.

- [ ] **Step 4: Record results**

If any step fails, create a follow-up Task 4 sub-task for the failure before proceeding.

---

### Task 4: Fix verification failures

**Files:**

- Varies based on failures found in Tasks 1–3.

**Interfaces:**

- Consumes: failure output from Tasks 1–3.
- Produces: corrected code/config that passes re-verification.

Use the following common fixes only if the corresponding failure occurs:

- [ ] **Step 1: Fix `server` workspace import in desktop main process**

If `electron-vite` cannot resolve `server` in production, change the import in `apps/desktop/src/main/index.ts`:

```ts
import { app as honoApp } from "server";
```

And update the server start call to:

```ts
const server = await startServer(honoApp, startPort);
```

- [ ] **Step 2: Fix renderer dev server port conflict**

If port `5174` is occupied, change `apps/desktop/electron.vite.config.ts`:

```ts
server: {
  port: 5174,
  strictPort: false,
},
```

- [ ] **Step 3: Fix CORS in production**

If the renderer cannot reach the server in the packaged app, update `apps/desktop/src/main/env.ts` to set `CORS_ORIGIN` before loading the Hono app:

```ts
import { config } from "dotenv";
import { app } from "electron";
import path from "node:path";

export function loadServerEnv(): void {
  const isDev = !app.isPackaged;
  if (isDev) {
    config({ path: path.resolve(process.cwd(), "..", "..", "apps", "server", ".env") });
  } else {
    config({ path: path.join(process.resourcesPath, ".env") });
  }

  process.env.CORS_ORIGIN = "*";
}
```

Then rebuild and re-test.

- [ ] **Step 4: Re-run the failing verification task**

After each fix, re-run the relevant verification command from Tasks 1–3 and confirm it passes.

- [ ] **Step 5: Commit fixes**

```bash
git add <fixed-files>
git commit -m "fix(desktop): resolve <issue>"
```

---

### Task 5: Update project documentation

**Files:**

- Modify: `CLAUDE.md`

**Interfaces:**

- Consumes: verified desktop commands and architecture.
- Produces: updated project guidance covering the desktop app.

- [ ] **Step 1: Add desktop overview to `CLAUDE.md`**

In the Project Overview section, add:

```markdown
- **Desktop**: `apps/desktop` — Electron app embedding the Hono backend and a Vite+React renderer; packaged with electron-builder.
```

- [ ] **Step 2: Add desktop commands to Common Commands**

Add a new subsection under Development:

````markdown
### Desktop

```bash
pnpm run dev:desktop       # Start Electron in dev mode with embedded Hono server
pnpm run build:desktop     # Build desktop production artifacts
pnpm run dist:desktop      # Build Windows installer and portable zip
pnpm run compile:desktop   # Build desktop with default electron-builder target
```
````

The desktop dev renderer server runs on port `5174` and the embedded Hono server on port `3002`.

````

- [ ] **Step 3: Add desktop package to Workspace and Package Layout table**

Add a row:

```markdown
| `apps/desktop` | `desktop` | `src/main/index.ts`, `src/renderer/main.tsx`, `electron.vite.config.ts`, `electron-builder.yml` |
````

- [ ] **Step 4: Commit documentation update**

```bash
git add CLAUDE.md
git commit -m "docs: add desktop app commands and architecture to CLAUDE.md"
```

---

### Task 6: Merge `electron-integration` into `main`

**Files:**

- Branch operation; no direct file edits.

**Interfaces:**

- Consumes: verified `electron-integration` branch.
- Produces: `main` branch with desktop integration.

- [ ] **Step 1: Switch to `main` and pull latest**

```bash
cd D:/dev/projects/shuaibin-cookie-app
git checkout main
git pull
```

- [ ] **Step 2: Merge the worktree branch**

```bash
git merge electron-integration
```

Expected: clean merge or only expected conflicts (e.g., `CLAUDE.md`, `package.json`). Resolve any conflicts by keeping desktop additions.

- [ ] **Step 3: Re-install dependencies on `main`**

```bash
pnpm install
```

Expected: lockfile is consistent; `electron-builder install-app-deps` runs.

- [ ] **Step 4: Run final checks on `main`**

```bash
pnpm run check-types
pnpm run lint
pnpm run format
```

Expected: all checks pass.

- [ ] **Step 5: Push `main`**

Only push if explicitly requested by the user:

```bash
git push origin main
```

---

### Task 7: Final verification on `main`

**Files:**

- No code changes expected; final smoke test.

**Interfaces:**

- Consumes: merged `main` branch.
- Produces: confidence that desktop and web workflows both work.

- [ ] **Step 1: Verify web workflow is unchanged**

```bash
pnpm run dev
```

Expected: browser opens to `http://localhost:5173`; web app works as before.

- [ ] **Step 2: Verify desktop workflow on `main`**

```bash
pnpm run dev:desktop
```

Expected: same as Task 1 Step 3.

- [ ] **Step 3: Verify desktop production build on `main`**

```bash
pnpm run build:desktop
```

Expected: same as Task 3 Step 1.

- [ ] **Step 4: Document any final issues**

If any verification step fails, open a task or issue before declaring completion.

---

## Self-Review Checklist

1. **Spec coverage:**
   - Validate dev workflow — Task 1.
   - Validate type checks and lint — Task 2.
   - Validate production build and packaging — Task 3.
   - Fix failures — Task 4.
   - Update documentation — Task 5.
   - Merge to `main` — Task 6.
   - Final verification — Task 7.

2. **Placeholder scan:**
   - No `TBD`, `TODO`, or vague instructions.
   - Common fixes in Task 4 are conditional and include concrete code.

3. **Type consistency:**
   - `startServer(app: Hono, startPort)` signature matches usage in `apps/desktop/src/main/index.ts`.
   - `window.electronAPI` interface matches preload exports.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-01-electron-integration-completion.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Which approach would you like?
