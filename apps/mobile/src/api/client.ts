import { API_URL } from '../config';
import { clearAccessToken, getAccessToken } from '../secure/token-store';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  /** Skip Authorization header (e.g. dev-login). */
  skipAuth?: boolean;
};

/**
 * Minimal API client. Never logs response bodies (may contain PHI).
 */
export async function apiRequest<T>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const token = opts.skipAuth
    ? null
    : (opts.token ?? (await getAccessToken()));

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (res.status === 401 && !opts.skipAuth) {
    await clearAccessToken();
  }

  if (!res.ok) {
    const err = data as {
      error?: { code?: string; message?: string };
      message?: string;
    } | null;
    throw new ApiError(
      res.status,
      err?.error?.code ?? 'REQUEST_FAILED',
      err?.error?.message ?? err?.message ?? `HTTP ${res.status}`,
    );
  }

  return data as T;
}
