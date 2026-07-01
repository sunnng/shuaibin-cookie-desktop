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
