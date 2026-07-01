# Electron Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `apps/desktop` Electron package that wraps the existing stack as a self-contained Windows desktop app while keeping `apps/web` deployable in the browser.

**Architecture:** The Electron main process imports the Hono app from `apps/server`, starts it on a dynamically discovered local port, creates a `BrowserWindow`, and loads the renderer. The renderer uses `contextBridge` to access a typed `window.electronAPI` for native capabilities and to discover the server port. Packaging uses `electron-vite` for building and `electron-builder` for Windows installers.

**Tech Stack:** Electron, electron-vite, electron-builder, Vite, React, TypeScript, Hono, pnpm workspaces.

## Global Constraints

- The existing `apps/web` browser target must remain untouched and functional.
- Use `electron-vite` as the build tool and `electron-builder` for packaging.
- Security defaults: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`.
- The Hono server from `apps/server` runs inside the Electron main process, not as a separate CLI app.
- Production port discovery scans from `3001` upward; development uses a fixed `3001` port via `apps/desktop/.env`.
- Packaging targets Windows only in this phase (`nsis` installer + `zip` portable).
- Native dependencies must be rebuilt for Electron via `electron-builder install-app-deps`.
- All privileged renderer access flows through the preload script; no direct Node/Electron imports in renderer code.

---

## File Structure

```
apps/desktop/
├── .env
├── electron-builder.yml
├── electron.vite.config.ts
├── package.json
├── tsconfig.json
└── src/
    ├── main/
    │   ├── index.ts
    │   ├── server.ts
    │   ├── ipc-handlers.ts
    │   ├── tray.ts
    │   └── updater.ts
    ├── preload/
    │   ├── index.ts
    │   └── api.d.ts
    └── renderer/
        ├── index.html
        ├── main.tsx
        ├── App.tsx
        └── api.ts

apps/server/
├── src/
│   ├── index.ts          # export app, no serve()
│   └── start.ts          # production server entry (calls serve())
└── package.json          # update main/start scripts

package.json              # root: add dev:desktop, build:desktop, dist:desktop
.gitignore                # add desktop out/dist/local.db*
```

---

### Task 1: Refactor `apps/server` to export the Hono app without auto-starting

**Files:**

- Modify: `apps/server/src/index.ts`
- Create: `apps/server/src/start.ts`
- Modify: `apps/server/package.json`

**Interfaces:**

- Consumes: nothing new.
- Produces: default export `app` from `apps/server/src/index.ts`; `apps/server/src/start.ts` is the standalone server entry.

- [ ] **Step 1: Extract `serve()` call into a separate entry**

Modify `apps/server/src/index.ts` to export the configured `app`, remove the `serve()` invocation, and load its own `.env` relative to the source file:

```ts
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, "../.env") });

import { env } from "@shuaibin-cookie-app/env/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
  }),
);

app.get("/", (c) => {
  return c.text("OK");
});

export { app };
export default app;
```

- [ ] **Step 2: Create the standalone server entry**

Create `apps/server/src/start.ts`:

```ts
import { serve } from "@hono/node-server";
import { app } from "./index.js";

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
```

- [ ] **Step 3: Update server package scripts**

Modify `apps/server/package.json`:

```json
{
  "scripts": {
    "build": "tsdown",
    "check-types": "tsc -b",
    "compile": "bun build --compile --minify --sourcemap --bytecode ./src/start.ts --outfile server",
    "dev": "tsx watch src/start.ts",
    "start": "node dist/start.mjs"
  }
}
```

Only `compile`, `dev`, and `start` changed from `./src/index.ts` to `./src/start.ts`.

- [ ] **Step 4: Verify the server still starts**

Run:

```bash
pnpm run dev:server
```

Expected: Server starts on `http://localhost:3000` and responds `OK` to `GET /`.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/index.ts apps/server/src/start.ts apps/server/package.json
git commit -m "refactor(server): export Hono app separately from serve entry"
```

---

### Task 2: Scaffold the `apps/desktop` package

**Files:**

- Create: `apps/desktop/package.json`
- Create: `apps/desktop/tsconfig.json`
- Create: `apps/desktop/.env`

**Interfaces:**

- Consumes: workspace packages `@shuaibin-cookie-app/env`, `@shuaibin-cookie-app/ui`, `server`; catalog deps.
- Produces: `apps/desktop` as a valid pnpm workspace package.

- [ ] **Step 1: Create `apps/desktop/package.json`**

```json
{
  "name": "desktop",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "compile": "electron-vite build && electron-builder",
    "dist:win": "electron-vite build && electron-builder --win",
    "postinstall": "electron-builder install-app-deps",
    "check-types": "tsc --noEmit"
  },
  "dependencies": {
    "@shuaibin-cookie-app/env": "workspace:*",
    "@shuaibin-cookie-app/ui": "workspace:*",
    "dotenv": "catalog:",
    "server": "workspace:*"
  },
  "devDependencies": {
    "@shuaibin-cookie-app/config": "workspace:*",
    "@types/node": "catalog:",
    "electron": "^34.0.0",
    "electron-builder": "^26.0.0",
    "electron-vite": "^3.0.0",
    "react": "catalog:",
    "react-dom": "catalog:",
    "typescript": "catalog:",
    "vite": "^8.0.8"
  }
}
```

- [ ] **Step 2: Create `apps/desktop/tsconfig.json`**

```json
{
  "extends": "@shuaibin-cookie-app/config/tsconfig.base.json",
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "outDir": "out",
    "rootDir": "src",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `apps/desktop/.env`**

```env
VITE_SERVER_URL=http://localhost:3001
```

- [ ] **Step 4: Install dependencies**

Run:

```bash
pnpm install
```

Expected: `node_modules/electron` and `node_modules/electron-vite` are installed; `electron-builder install-app-deps` runs for the desktop package.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/package.json apps/desktop/tsconfig.json apps/desktop/.env pnpm-lock.yaml
if ($?) { git commit -m "chore(desktop): scaffold desktop package" }
```

---

### Task 3: Configure electron-vite and electron-builder

**Files:**

- Create: `apps/desktop/electron.vite.config.ts`
- Create: `apps/desktop/electron-builder.yml`

**Interfaces:**

- Consumes: source files in `src/main`, `src/preload`, `src/renderer`.
- Produces: `out/main`, `out/preload`, `out/renderer` directories; `dist/` installer artifacts.

- [ ] **Step 1: Create electron-vite config**

Create `apps/desktop/electron.vite.config.ts`:

```ts
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "out/main",
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, "src/main/index.ts"),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "out/preload",
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, "src/preload/index.ts"),
        },
      },
    },
  },
  renderer: {
    root: path.resolve(__dirname, "src/renderer"),
    build: {
      outDir: "out/renderer",
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, "src/renderer/index.html"),
        },
      },
    },
    plugins: [tailwindcss(), react()],
    resolve: {
      tsconfigPaths: true,
    },
  },
});
```

- [ ] **Step 2: Create electron-builder config**

Create `apps/desktop/electron-builder.yml`:

```yaml
appId: com.shuaibin-cookie-app.desktop
productName: ShuaibinCookieApp
copyright: Copyright © 2026
directories:
  output: dist
  buildResources: build-resources
files:
  - out/**
  - package.json
asar: true
win:
  target:
    - target: nsis
      arch: x64
    - target: zip
      arch: x64
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: ShuaibinCookieApp
```

- [ ] **Step 3: Verify build config parses**

Run:

```bash
pnpm --filter desktop build
```

Expected: Build may fail because source files do not exist yet; that is acceptable. If it fails due to config syntax, fix the config before proceeding.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/electron.vite.config.ts apps/desktop/electron-builder.yml
git commit -m "chore(desktop): add electron-vite and electron-builder configs"
```

---

### Task 4: Create the preload script and typed API

**Files:**

- Create: `apps/desktop/src/preload/index.ts`
- Create: `apps/desktop/src/preload/api.d.ts`

**Interfaces:**

- Consumes: `electron` APIs.
- Produces: `window.electronAPI` typed interface used by the renderer.

- [ ] **Step 1: Create preload script**

Create `apps/desktop/src/preload/index.ts`:

```ts
import { contextBridge, ipcRenderer } from "electron";

export interface ElectronAPI {
  getServerPort: () => Promise<number>;
  openFile: (options?: Electron.OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>;
  saveFile: (options?: Electron.SaveDialogOptions) => Promise<Electron.SaveDialogReturnValue>;
  showNotification: (options: Electron.NotificationConstructorOptions) => Promise<void>;
  minimizeToTray: () => Promise<void>;
  platform: NodeJS.Platform;
}

const electronAPI: ElectronAPI = {
  getServerPort: () => ipcRenderer.invoke("server:getPort"),
  openFile: (options) => ipcRenderer.invoke("dialog:openFile", options),
  saveFile: (options) => ipcRenderer.invoke("dialog:saveFile", options),
  showNotification: (options) => ipcRenderer.invoke("notification:show", options),
  minimizeToTray: () => ipcRenderer.invoke("app:minimizeToTray"),
  platform: process.platform,
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
```

- [ ] **Step 2: Create type declarations**

Create `apps/desktop/src/preload/api.d.ts`:

```ts
import type { ElectronAPI } from "./index";

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/preload/index.ts apps/desktop/src/preload/api.d.ts
git commit -m "feat(desktop): add preload script with typed electronAPI"
```

---

### Task 5: Create the embedded Hono server wrapper with port discovery

**Files:**

- Create: `apps/desktop/src/main/server.ts`

**Interfaces:**

- Consumes: `app` from `apps/server/src/index.ts`.
- Produces: `startServer(startPort)` returns `{ port, stop }`.

- [ ] **Step 1: Implement port discovery**

Create `apps/desktop/src/main/server.ts`:

```ts
import { serve } from "@hono/node-server";
import type { Hono } from "hono";

const MAX_PORT_ATTEMPTS = 100;

export async function startServer(
  app: Hono,
  startPort = 3001,
): Promise<{ port: number; stop: () => void }> {
  for (let offset = 0; offset < MAX_PORT_ATTEMPTS; offset++) {
    const port = startPort + offset;
    try {
      const server = await new Promise<ReturnType<typeof serve>>((resolve, reject) => {
        const s = serve(
          {
            fetch: app.fetch,
            port,
          },
          (info) => {
            if (info.port === port) {
              resolve(s);
            } else {
              reject(new Error(`Server started on unexpected port ${info.port}`));
            }
          },
        );
        s.on("error", (err) => reject(err));
      });

      return {
        port,
        stop: () => server.close(),
      };
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "EADDRINUSE" && code !== "EACCES") {
        throw err;
      }
    }
  }

  throw new Error(
    `Unable to find an available port after ${MAX_PORT_ATTEMPTS} attempts starting from ${startPort}`,
  );
}
```

- [ ] **Step 2: Verify the wrapper compiles**

Run:

```bash
pnpm --filter desktop check-types
```

Expected: TypeScript compiles without errors. If `@hono/node-server` types are missing, add `@types/node` or adjust imports.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/main/server.ts
git commit -m "feat(desktop): add embedded Hono server with port discovery"
```

---

### Task 6: Create main-process IPC handlers

**Files:**

- Create: `apps/desktop/src/main/ipc-handlers.ts`
- Create: `apps/desktop/src/main/tray.ts`
- Create: `apps/desktop/src/main/updater.ts`

**Interfaces:**

- Consumes: `BrowserWindow`, `serverPort` from main process.
- Produces: IPC handlers registered on `ipcMain`.

- [ ] **Step 1: Create IPC handlers module**

Create `apps/desktop/src/main/ipc-handlers.ts`:

```ts
import { dialog, ipcMain, Notification } from "electron";
import type { BrowserWindow } from "electron";

export function registerIpcHandlers({
  mainWindow,
  getServerPort,
}: {
  mainWindow: BrowserWindow;
  getServerPort: () => number;
}) {
  ipcMain.handle("server:getPort", () => getServerPort());

  ipcMain.handle("dialog:openFile", async (_, options) => {
    return dialog.showOpenDialog(mainWindow, options);
  });

  ipcMain.handle("dialog:saveFile", async (_, options) => {
    return dialog.showSaveDialog(mainWindow, options);
  });

  ipcMain.handle("notification:show", async (_, options) => {
    const notification = new Notification(options);
    notification.show();
  });

  ipcMain.handle("app:minimizeToTray", () => {
    mainWindow.hide();
  });
}
```

- [ ] **Step 2: Create tray module**

Create `apps/desktop/src/main/tray.ts`:

```ts
import { app, Menu, Tray } from "electron";
import type { BrowserWindow } from "electron";
import fs from "node:fs";
import path from "node:path";

let tray: Tray | null = null;

export function createTray(mainWindow: BrowserWindow): Tray | null {
  const iconPath = path.join(process.resourcesPath, "icon.png");
  // Create tray with icon only if it exists; otherwise create a default 1x1 transparent icon.
  if (fs.existsSync(iconPath)) {
    tray = new Tray(iconPath);
  } else {
    const emptyIcon = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    tray = new Tray(emptyIcon);
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show",
      click: () => {
        mainWindow.show();
      },
    },
    {
      label: "Quit",
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip("ShuaibinCookieApp");
  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    mainWindow.show();
  });

  return tray;
}
```

- [ ] **Step 3: Create auto-updater stub**

Create `apps/desktop/src/main/updater.ts`:

```ts
import { app } from "electron";

export function initAutoUpdater(): void {
  // Auto-updater requires code signing and a publish provider.
  // This stub logs the current version and can be wired to electron-updater later.
  console.log(`[updater] Current version: ${app.getVersion()}`);
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/main/ipc-handlers.ts apps/desktop/src/main/tray.ts apps/desktop/src/main/updater.ts
git commit -m "feat(desktop): add main process IPC handlers, tray, and updater stub"
```

---

### Task 7: Create the main process entry

**Files:**

- Create: `apps/desktop/src/main/index.ts`
- Create: `apps/desktop/src/main/env.ts`

**Interfaces:**

- Consumes: `registerIpcHandlers` from `./ipc-handlers.js`, `createTray` from `./tray.js`, `initAutoUpdater` from `./updater.js`, `app` from `electron`; dynamically imports the Hono `app` from `server` and `startServer` from `./server.js` after `loadServerEnv()` populates `process.env`.
- Produces: running Electron application.

- [ ] **Step 1: Create environment loader**

Create `apps/desktop/src/main/env.ts`:

```ts
import { config } from "dotenv";
import { app } from "electron";
import path from "node:path";

export function loadServerEnv(): void {
  const isDev = !app.isPackaged;
  if (isDev) {
    // In development, load the shared server .env from the monorepo.
    // Must run before importing the Hono app so process.env is populated.
    config({ path: path.resolve(process.cwd(), "..", "..", "apps", "server", ".env") });
  } else {
    // In production, optionally load a .env next to the packaged app.
    config({ path: path.join(process.resourcesPath, ".env") });
  }
}
```

- [ ] **Step 2: Implement main process entry**

Create `apps/desktop/src/main/index.ts`:

```ts
import { app, BrowserWindow, shell } from "electron";
import path from "node:path";

import { loadServerEnv } from "./env.js";
loadServerEnv();

import { registerIpcHandlers } from "./ipc-handlers.js";
import { createTray } from "./tray.js";
import { initAutoUpdater } from "./updater.js";

let mainWindow: BrowserWindow | null = null;
let serverPort = 0;
let stopServer: (() => void) | null = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  registerIpcHandlers({
    mainWindow,
    getServerPort: () => serverPort,
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (process.env.NODE_ENV === "development" || !app.isPackaged) {
    await mainWindow.loadURL("http://localhost:5174");
    mainWindow.webContents.openDevTools();
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(async () => {
  const [{ app: honoApp }, { startServer }] = await Promise.all([
    import("server"),
    import("./server.js"),
  ]);

  const server = await startServer(honoApp, 3001);
  serverPort = server.port;
  stopServer = server.stop;

  console.log(`[desktop] Embedded Hono server running on port ${serverPort}`);

  await createWindow();
  createTray(mainWindow!);
  initAutoUpdater();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (stopServer) {
    stopServer();
  }
});
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/main/env.ts apps/desktop/src/main/index.ts
git commit -m "feat(desktop): add Electron main process entry and env loader"
```

---

### Task 8: Create the renderer entry and API client

**Files:**

- Create: `apps/desktop/src/renderer/index.html`
- Create: `apps/desktop/src/renderer/main.tsx`
- Create: `apps/desktop/src/renderer/App.tsx`
- Create: `apps/desktop/src/renderer/api.ts`

**Interfaces:**

- Consumes: `window.electronAPI`, `@shuaibin-cookie-app/ui`, React.
- Produces: rendered desktop UI that calls the embedded Hono API.

- [ ] **Step 1: Create renderer HTML entry**

Create `apps/desktop/src/renderer/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ShuaibinCookieApp</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create API client**

Create `apps/desktop/src/renderer/api.ts`:

```ts
let serverPort: number | null = null;

export async function getApiBaseUrl(): Promise<string> {
  if (serverPort) {
    return `http://localhost:${serverPort}`;
  }

  if (import.meta.env.DEV) {
    const url = import.meta.env.VITE_SERVER_URL;
    if (!url) {
      throw new Error("VITE_SERVER_URL is not set");
    }
    return url;
  }

  if (!window.electronAPI) {
    throw new Error("electronAPI is not available");
  }

  serverPort = await window.electronAPI.getServerPort();
  return `http://localhost:${serverPort}`;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = await getApiBaseUrl();
  return fetch(`${base}${path}`, init);
}
```

- [ ] **Step 3: Create App component**

Create `apps/desktop/src/renderer/App.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Button } from "@shuaibin-cookie-app/ui/components/button";
import { apiFetch } from "./api.js";

export function App() {
  const [status, setStatus] = useState<string>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/")
      .then(async (res) => {
        const text = await res.text();
        setStatus(text);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">ShuaibinCookieApp Desktop</h1>
      <section className="mt-6 rounded-lg border p-4">
        <h2 className="mb-2 font-medium">API Status</h2>
        {error ? (
          <p className="text-destructive">Error: {error}</p>
        ) : (
          <p className="font-mono">{status}</p>
        )}
      </section>
      <div className="mt-4">
        <Button
          onClick={() =>
            window.electronAPI.showNotification({ title: "Hello", body: "From desktop" })
          }
        >
          Show notification
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create renderer main entry**

Create `apps/desktop/src/renderer/main.tsx`:

```tsx
import ReactDOM from "react-dom/client";
import { App } from "./App.js";
import "@shuaibin-cookie-app/ui/globals.css";

const rootElement = document.getElementById("app");

if (!rootElement) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(rootElement).render(<App />);
```

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/renderer/
git commit -m "feat(desktop): add renderer entry, API client, and App shell"
```

---

### Task 9: Wire root scripts and ignore desktop build artifacts

**Files:**

- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**

- Consumes: `apps/desktop` scripts.
- Produces: convenient root-level commands.

- [ ] **Step 1: Add root shortcuts**

Modify root `package.json` scripts to add:

```json
{
  "scripts": {
    "dev:desktop": "vp run --filter desktop dev",
    "build:desktop": "vp run --filter desktop build",
    "dist:desktop": "vp run --filter desktop dist:win",
    "compile:desktop": "vp run --filter desktop compile"
  }
}
```

Keep the existing scripts unchanged.

- [ ] **Step 2: Update `.gitignore`**

Append:

```gitignore
# Electron desktop build outputs
apps/desktop/out
apps/desktop/dist
apps/desktop/local.db*
```

- [ ] **Step 3: Commit**

```bash
git add package.json .gitignore
git commit -m "chore: add desktop root scripts and ignore build outputs"
```

---

### Task 10: Verify the development workflow

**Files:**

- None (manual verification).

**Interfaces:**

- Consumes: all previous tasks.
- Produces: working dev Electron app.

- [ ] **Step 1: Run the desktop app in dev mode**

Run:

```bash
pnpm run dev:desktop
```

Expected: Electron window opens, loads the renderer from `http://localhost:5174`, embedded Hono server starts on port `3001`, and the UI displays `OK` from `GET /`.

- [ ] **Step 2: Verify notification button**

Click the "Show notification" button in the app.

Expected: A native OS notification appears.

- [ ] **Step 3: Verify web app still works**

In a separate terminal, run:

```bash
pnpm run dev
```

Expected: Browser opens to `http://localhost:5173` and the original web app works as before.

- [ ] **Step 4: Commit verification notes**

No code change; if fixes were needed, commit them with a descriptive message.

---

### Task 11: Verify production build and packaging

**Files:**

- None (manual verification).

**Interfaces:**

- Consumes: all previous tasks.
- Produces: packaged Windows installer/zip.

- [ ] **Step 1: Build the desktop app**

Run:

```bash
pnpm run build:desktop
```

Expected: `apps/desktop/out/main`, `out/preload`, and `out/renderer` are created without errors.

- [ ] **Step 2: Package for Windows**

Run:

```bash
pnpm run dist:desktop
```

Expected: `apps/desktop/dist` contains `ShuaibinCookieApp Setup.exe` (NSIS) and `ShuaibinCookieApp-win32-x64.zip`.

- [ ] **Step 3: Run the packaged app**

Run the installer or extract the zip and run `ShuaibinCookieApp.exe`.

Expected: App launches, embedded server starts (dynamic port), renderer loads, and `OK` is shown.

- [ ] **Step 4: Commit any fixes**

If packaging required config tweaks, commit them.

---

### Task 12: Add desktop-specific type checks to root check

**Files:**

- Modify: root `package.json`

**Interfaces:**

- Consumes: `apps/desktop` `check-types` script.
- Produces: integrated type checking.

- [ ] **Step 1: Add desktop type check to root script**

Modify root `package.json`:

```json
{
  "scripts": {
    "check-types": "vp run -r check-types"
  }
}
```

If `vp run -r check-types` already runs `check-types` in every workspace package, no change is needed. Verify by running:

```bash
pnpm run check-types
```

Expected: TypeScript checks pass for `apps/desktop` along with other packages.

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "chore: include desktop in root type checks"
```

---

## Self-Review Checklist

1. **Spec coverage:**
   - `apps/web` untouched — yes, no tasks modify it.
   - electron-vite + electron-builder — yes, Task 3.
   - Security defaults — yes, Task 7.
   - Embedded Hono server — yes, Tasks 1, 5, 7.
   - Dynamic port discovery — yes, Task 5.
   - Windows packaging — yes, Task 3 and Task 11.
   - Native capabilities — yes, Task 6.

2. **Placeholder scan:**
   - No `TBD`, `TODO`, or vague instructions.
   - All code snippets are concrete and copy-pasteable.

3. **Type consistency:**
   - `window.electronAPI` interface matches preload exports.
   - `startServer` returns `{ port, stop }` used in main process.
   - `getServerPort` used in IPC handler matches renderer API call.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-01-electron-integration.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Which approach would you like?
