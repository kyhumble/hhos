import { API_URL } from '../config';
import { clearAllCachedClinicalGrants } from '../secure/consent-cache';
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
 * True when the failure is transport-level (device offline / DNS / aborted).
 * HTTP responses (including 4xx/5xx) are not transport failures.
 */
export function isTransportFailure(err: unknown): boolean {
  if (err instanceof ApiError) return false;
  if (err instanceof TypeError) return true;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes('network request failed') ||
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('aborted') ||
      err.name === 'AbortError'
    );
  }
  return false;
}

/**
 * HTTP statuses that are authoritative while online: never fall back to consent cache.
 * 401 session invalid; 403/404 caseload or patient denial / missing.
 */
export function isAuthoritativeOnlineDenial(status: number): boolean {
  return status === 401 || status === 403 || status === 404;
}

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
    // Session invalid while online — wipe token + consent grants
    await clearAccessToken();
    await clearAllCachedClinicalGrants();
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
