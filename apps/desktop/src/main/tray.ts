import { app, Menu, nativeImage, Tray } from "electron";
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
    tray = new Tray(nativeImage.createFromBuffer(emptyIcon));
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
