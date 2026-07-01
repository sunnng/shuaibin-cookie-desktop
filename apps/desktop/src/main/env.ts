import { config } from "dotenv";
import { app } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";

function resolveServerEnvPath(): string {
  // Try import.meta.url first (works in both bundled and unbundled ESM).
  if (typeof import.meta.url !== "undefined") {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(__dirname, "..", "..", "..", "..", "apps", "server", ".env");
  }
  // Fallback for environments without import.meta.url.
  return path.resolve(process.cwd(), "..", "..", "apps", "server", ".env");
}

export function loadServerEnv(): void {
  const isDev = !app.isPackaged;
  if (isDev) {
    // In development, load the shared server .env from the monorepo.
    // Must run before importing the Hono app so process.env is populated.
    config({ path: resolveServerEnvPath() });
  } else {
    // In production, optionally load a .env next to the packaged app.
    config({ path: path.join(process.resourcesPath, ".env") });
    // The renderer loads from file:// protocol, so allow any origin.
    process.env.CORS_ORIGIN = "*";
  }
}
