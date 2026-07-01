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
