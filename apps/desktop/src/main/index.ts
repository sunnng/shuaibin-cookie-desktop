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
