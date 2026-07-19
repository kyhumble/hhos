/** Shared web client helpers for Phase 1/2 API calls. */

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('hhos_token');
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
};

/** Parse Nest-style `{ error: { code, message } }` or generic failure. */
export async function readApiError(res: Response): Promise<{
  code?: string;
  message: string;
}> {
  try {
    const data = (await res.json()) as ApiErrorBody;
    return {
      code: data.error?.code,
      message: data.error?.message ?? `Request failed (${res.status})`,
    };
  } catch {
    return { message: `Request failed (${res.status})` };
  }
}
