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
    const notification = new Notification(options);
    notification.show();
  });

  ipcMain.handle("app:minimizeToTray", () => {
    mainWindow.hide();
  });
}
