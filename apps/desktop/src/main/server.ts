import { serve } from "@hono/node-server";
import type { Hono } from "hono";

const MAX_PORT_ATTEMPTS = 100;

export async function startServer(app: Hono, startPort = 3001): Promise<{ port: number; stop: () => void }> {
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

  throw new Error(`Unable to find an available port after ${MAX_PORT_ATTEMPTS} attempts starting from ${startPort}`);
}
