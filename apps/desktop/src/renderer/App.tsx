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
