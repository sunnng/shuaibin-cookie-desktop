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

  ipcMain.handle("notification:show", (_, options) => {
    if (!Notification.isSupported()) {
      console.warn("[desktop] Notifications are not supported on this system");
      return;
    }
    try {
      const notification = new Notification(options);
      notification.show();
    } catch (err) {
      console.error("[desktop] Failed to show notification:", err);
    }
  });

  ipcMain.handle("app:minimizeToTray", () => {
    mainWindow.hide();
  });
}
