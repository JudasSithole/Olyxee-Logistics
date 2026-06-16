/**
 * Lightweight fetch client for the Olyxee Express API.
 *
 * The SPA talks to the backend exclusively through the `/api` prefix, which
 * Vite proxies to the API server in development and which is served from the
 * same origin in production. The session is a httpOnly cookie, so every request
 * sends credentials and no token handling is needed on the client.
 */

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
}

export async function apiFetch<T = unknown>(
  path: string,
  opts: ApiRequestOptions = {},
): Promise<T> {
  const { method = "GET", body, query } = opts;

  let url = path;
  if (query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      params.append(key, String(value));
    }
    const qs = params.toString();
    if (qs) url += (url.includes("?") ? "&" : "?") + qs;
  }

  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!res.ok) {
    const message =
      (json && typeof json === "object" && "error" in json
        ? String((json as { error: unknown }).error)
        : null) ?? res.statusText ?? "Request failed";
    throw new ApiError(message, res.status);
  }

  return json as T;
}
