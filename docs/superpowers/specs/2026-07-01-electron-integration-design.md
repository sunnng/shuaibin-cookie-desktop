# Electron Integration Design

## Summary

Add an `apps/desktop` package to the existing Better-T-Stack monorepo to deliver a cross-platform desktop application while keeping `apps/web` usable in the browser. The Electron main process embeds the Hono server from `apps/server` so the desktop app is self-contained. The renderer process reuses shared packages (`packages/ui`, `packages/env`, `packages/db`) and can share UI code with `apps/web`.

## Goals

- Provide a Windows desktop application alongside the existing web app.
- Reuse the React + TanStack Router + Tailwind + shadcn/ui stack already in use.
- Bundle the Hono backend inside the Electron main process so users do not need to run a separate server.
- Support native desktop capabilities: file system dialogs, notifications, system tray/menu bar, and auto-updater.
- Maintain strong security defaults (context isolation, sandbox, no `nodeIntegration`).

## Non-Goals

- Replace the browser/web deployment.
- Code-signing or store distribution in this phase.
- macOS or Linux installers in this phase (structure supports adding them later).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Electron Main Process                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Hono server  │  │ BrowserWindow│  │ ipcMain handlers │  │
│  │ (localhost)  │  │ (renderer)   │  │ (fs, tray, etc.) │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ contextBridge
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Electron Renderer Process                 │
│              React + TanStack Router + packages/ui           │
└─────────────────────────────────────────────────────────────┘
```

### Key decisions

1. **Keep `apps/web` untouched.** The browser SPA continues to work independently.
2. **Embed the Hono server in the main process.** `apps/server/src/index.ts` is imported and started from `apps/desktop/src/main/index.ts` on a local port.
3. **Dynamic port discovery in production.** The main process scans for an available port starting at `3001` and exposes the actual port to the renderer via the preload API.
4. **Fixed port in development.** `apps/desktop/.env` sets `VITE_SERVER_URL=http://localhost:3001` for deterministic local development.

## Project Structure

New files and directories under `apps/desktop`:

```
apps/desktop/
├── .env                          # Dev env (VITE_SERVER_URL, etc.)
├── electron-builder.yml          # Packaging configuration
├── electron.vite.config.ts       # electron-vite config
├── package.json                  # Desktop package scripts & deps
├── src/
│   ├── main/
│   │   ├── index.ts              # Main process bootstrap
│   │   ├── server.ts             # Hono server wrapper + port scanner
│   │   ├── tray.ts               # System tray / menu bar logic
│   │   ├── updater.ts            # Auto-updater setup
│   │   └── ipc-handlers.ts       # ipcMain handlers (fs, dialogs, notifications)
│   ├── preload/
│   │   └── index.ts              # contextBridge API exposure
│   └── renderer/
│       ├── main.tsx              # React root
│       ├── App.tsx               # Desktop-specific app shell
│       ├── api.ts                # Build API URL using window.electronAPI.getServerPort()
│       └── index.html            # Renderer HTML entry
```

Root-level changes:

- `pnpm-workspace.yaml` already includes `apps/*`; no change needed.
- `package.json` adds shortcuts: `dev:desktop`, `build:desktop`, `dist:desktop`.
- `.gitignore` adds `apps/desktop/out`, `apps/desktop/dist`, and `apps/desktop/local.db*`.

## Main Process

Responsibilities:

1. Import the Hono app from `apps/server` and start it on an available port.
2. Create the `BrowserWindow` with security-focused `webPreferences`.
3. Load the renderer:
   - Development: `http://localhost:5174` (electron-vite renderer dev server).
   - Production: `file://…/out/renderer/index.html`.
4. Register IPC handlers for:
   - `dialog:openFile`, `dialog:saveFile`
   - `notification:show`
   - `app:quit`, `app:minimize-to-tray`
   - `server:getPort`
5. Initialize the system tray and auto-updater when appropriate.

**Note:** `apps/server/src/index.ts` currently calls `serve()` directly. For embedding, refactor it to export the configured `app` (and optionally a `startServer(port)` helper) and keep `serve()` invocation in a separate `apps/server/src/start.ts` entry. This lets the Electron main process start the Hono app on a dynamically chosen port.

## Preload Script

Expose a minimal, typed API to the renderer:

```ts
contextBridge.exposeInMainWorld("electronAPI", {
  getServerPort: () => ipcRenderer.invoke("server:getPort"),
  openFile: (options) => ipcRenderer.invoke("dialog:openFile", options),
  saveFile: (options) => ipcRenderer.invoke("dialog:saveFile", options),
  showNotification: (options) => ipcRenderer.invoke("notification:show", options),
  onTrayEvent: (callback) => ipcRenderer.on("tray:event", callback),
  platform: process.platform,
});
```

TypeScript types for `window.electronAPI` are declared in `apps/desktop/src/preload/api.d.ts` and imported in the renderer.

## Renderer Process

- Entry: `src/renderer/main.tsx`.
- Uses React 19 and can optionally use TanStack Router with its own desktop-specific route tree (`src/renderer/routes/`).
- Imports UI from `@shuaibin-cookie-app/ui/components/*` and global styles from `@shuaibin-cookie-app/ui/globals.css`.
- API client initialization waits for `window.electronAPI.getServerPort()` then constructs `http://localhost:${port}` as the base URL.
- In development, the renderer can also use `import.meta.env.VITE_SERVER_URL` for a simpler fixed URL.

## Security Model

- `contextIsolation: true` (default in modern Electron).
- `nodeIntegration: false`.
- `sandbox: true` for the renderer.
- `webSecurity: true`; CORS in the Hono server allows both the dev renderer origin (`http://localhost:5174`) and the production `file://` origin. The main process sets `CORS_ORIGIN` appropriately before starting Hono.
- Renderer never imports Node.js or Electron modules directly.
- All privileged operations flow through the typed preload API.
- `apps/server/.env` is loaded in the main process; renderer env is limited to `VITE_` prefixed values via `packages/env/src/web.ts`.

## Port Discovery

Development:

- Fixed port `3001` via `apps/desktop/.env`.
- Renderer reads `VITE_SERVER_URL=http://localhost:3001`.

Production:

- `apps/desktop/src/main/server.ts` tries ports starting at `3001`, incrementing until `createServer` succeeds.
- The chosen port is stored in main-process state.
- `ipcMain.handle("server:getPort", () => port)` returns it.
- Renderer calls `window.electronAPI.getServerPort()` before the first API request.

## Build & Packaging

### electron-vite configuration

`electron.vite.config.ts` defines three build targets:

- `main`: `src/main/index.ts` → `out/main/index.js`
- `preload`: `src/preload/index.ts` → `out/preload/index.js`
- `renderer`: `src/renderer/index.html` → `out/renderer/`

### Scripts (apps/desktop)

```json
{
  "dev": "electron-vite dev",
  "build": "electron-vite build",
  "compile": "electron-vite build && electron-builder",
  "dist:win": "electron-vite build && electron-builder --win",
  "postinstall": "electron-builder install-app-deps"
}
```

### Root shortcuts

```json
{
  "dev:desktop": "vp run --filter desktop dev",
  "build:desktop": "vp run --filter desktop build",
  "dist:desktop": "vp run --filter desktop dist:win"
}
```

### electron-builder configuration

Target Windows only in this phase:

```yaml
appId: com.shuaibin-cookie-app.desktop
productName: ShuaibinCookieApp
directories:
  output: dist
files:
  - out/**
  - package.json
win:
  target:
    - nsis
    - zip
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
```

## Dev Workflow

1. Run `pnpm install` (triggers `postinstall` to rebuild native deps for Electron).
2. Run `pnpm dev` for browser development (unchanged behavior).
3. Run `pnpm dev:desktop` for desktop development with HMR and embedded server.
4. Run `pnpm build:desktop` to produce production build artifacts.
5. Run `pnpm dist:desktop` to produce the Windows installer and portable zip.

## Dependencies

Add to `apps/desktop`:

- `electron` (dev)
- `electron-vite` (dev)
- `electron-builder` (dev)
- `@shuaibin-cookie-app/env`, `@shuaibin-cookie-app/ui`, `@shuaibin-cookie-app/db`, `server` (workspace)
- `vite`, `react`, `react-dom`, `typescript` (via catalog or workspace reuse)

## Risks & Mitigations

| Risk                                                   | Mitigation                                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Port `3001` occupied in production                     | Dynamic port discovery + API to expose port to renderer.                              |
| Native dependencies incompatible with Electron         | Use `electron-builder install-app-deps` in `postinstall`.                             |
| Large bundle size                                      | electron-vite tree-shakes main/preload; renderer reuses shared packages.              |
| CORS mismatch between dev renderer and embedded server | Set `CORS_ORIGIN` to allow both dev server origin and `file://` origin in production. |
| Auto-updater requires code signing                     | Configure publish target but do not enable auto-update until signing is available.    |

## Open Questions

- Should the desktop renderer share TanStack Router routes with `apps/web`, or keep a separate route tree?
- Should the desktop app support offline-first storage beyond the local SQLite database?
- When will code signing be available for the auto-updater?

## Next Step

After this design is approved, invoke `superpowers:writing-plans` to create the implementation plan.
