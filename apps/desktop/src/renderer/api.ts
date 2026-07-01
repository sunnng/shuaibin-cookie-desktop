let serverPort: number | null = null;

export async function getApiBaseUrl(): Promise<string> {
  if (serverPort) {
    return `http://localhost:${serverPort}`;
  }

  if (import.meta.env.DEV) {
    const url = import.meta.env.VITE_SERVER_URL;
    if (!url) {
      throw new Error("VITE_SERVER_URL is not set");
    }
    return url;
  }

  if (!window.electronAPI) {
    throw new Error("electronAPI is not available");
  }

  serverPort = await window.electronAPI.getServerPort();
  return `http://localhost:${serverPort}`;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = await getApiBaseUrl();
  return fetch(`${base}${path}`, init);
}
