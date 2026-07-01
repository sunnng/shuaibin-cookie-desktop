import { app } from "electron";

export function initAutoUpdater(): void {
  // Auto-updater requires code signing and a publish provider.
  // This stub logs the current version and can be wired to electron-updater later.
  console.log(`[updater] Current version: ${app.getVersion()}`);
}
