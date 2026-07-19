/** Shared web client helpers for Phase 1/2 API calls. */

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const TOKEN_KEY = 'hhos_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  const t = raw.trim();
  // Guard against accidental double "Bearer " or quotes from copy/paste
  const cleaned = t.replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '');
  return cleaned || null;
}

export function authHeaders(token?: string | null): HeadersInit {
  const t = token ?? getToken();
  if (!t) return {};
  return { Authorization: `Bearer ${t}` };
}

export type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
  };
  message?: string | { error?: { code?: string; message?: string } };
  statusCode?: number;
};

/** Parse Nest-style `{ error: { code, message } }` or generic failure. */
export async function readApiError(res: Response): Promise<{
  code?: string;
  message: string;
  status: number;
}> {
  try {
    const data = (await res.json()) as ApiErrorBody;
    // Standard HHOS shape
    if (data.error?.message) {
      return {
        code: data.error.code,
        message: data.error.message,
        status: res.status,
      };
    }
    // Nest sometimes nests object message
    if (data.message && typeof data.message === 'object' && data.message.error?.message) {
      return {
        code: data.message.error.code,
        message: data.message.error.message,
        status: res.status,
      };
    }
    if (typeof data.message === 'string') {
      return { message: data.message, status: res.status };
    }
    return { message: `Request failed (${res.status})`, status: res.status };
  } catch {
    return { message: `Request failed (${res.status})`, status: res.status };
  }
}

export function isAuthError(status: number, code?: string): boolean {
  return (
    status === 401 ||
    code === 'UNAUTHORIZED' ||
    code === 'TOKEN_EXPIRED' ||
    code === 'AUTH_NOT_CONFIGURED'
  );
}
