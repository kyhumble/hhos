/**
 * Client-side auth session for the ops console.
 * Token + user (roles/permissions) from dev-login or GET /v1/me.
 */
import { Permission, type PermissionCode, type RoleCode } from '@hhos/shared';
import { API_URL, authHeaders, getToken, isAuthError, readApiError } from './api';

export type SessionUser = {
  id: string;
  orgId: string;
  email: string;
  fullName: string;
  roles: RoleCode[];
  permissions: PermissionCode[];
};

const USER_KEY = 'hhos_user';
const TOKEN_KEY = 'hhos_token';

export function getStoredUser(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function storeSession(token: string, user: SessionUser): void {
  if (typeof window === 'undefined') return;
  const clean = token.trim().replace(/^Bearer\s+/i, '');
  window.localStorage.setItem(TOKEN_KEY, clean);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

/** Clear local session and send user to login with a reason banner. */
export function forceReLogin(reason: 'session' | 'required' = 'session'): void {
  clearSession();
  if (typeof window === 'undefined') return;
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.href = `/login?reason=${reason}&next=${next}`;
}

export function hasPermission(
  user: SessionUser | null | undefined,
  permission: PermissionCode,
): boolean {
  return Boolean(user?.permissions?.includes(permission));
}

export function canReadWoundPhotos(user: SessionUser | null | undefined): boolean {
  return hasPermission(user, Permission.WOUND_PHOTO_READ);
}

export function canReadClinicalTasks(user: SessionUser | null | undefined): boolean {
  return hasPermission(user, Permission.CLINICAL_TASK_READ);
}

export function canWriteClinicalTasks(user: SessionUser | null | undefined): boolean {
  return hasPermission(user, Permission.CLINICAL_TASK_WRITE);
}

export function canBreakGlass(user: SessionUser | null | undefined): boolean {
  return hasPermission(user, Permission.BREAK_GLASS_PHI);
}

/** Roles that may use the normal clinical content path (not break-glass only). */
export function canUseClinicalContentPath(
  user: SessionUser | null | undefined,
): boolean {
  if (!user) return false;
  return user.roles.some(
    (r) => r === 'field_rn' || r === 'clinical_lead' || r === 'admin',
  );
}

/**
 * Load session user: prefer localStorage; refresh from /v1/me when token present.
 * Clears storage when token is rejected (401).
 */
export async function loadSessionUser(): Promise<SessionUser | null> {
  const token = getToken();
  if (!token) {
    // Stale user blob without token
    if (getStoredUser()) clearSession();
    return null;
  }

  const cached = getStoredUser();
  try {
    const res = await fetch(`${API_URL}/v1/me`, {
      headers: authHeaders(token),
    });
    if (!res.ok) {
      if (res.status === 401) {
        clearSession();
        return null;
      }
      return cached;
    }
    const data = (await res.json()) as { user?: SessionUser };
    if (data.user) {
      window.localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      return data.user;
    }
    return cached;
  } catch {
    return cached;
  }
}

/**
 * If response is 401/expired session, clear and redirect to login.
 * Returns true when handled (caller should stop).
 */
export async function handleIfUnauthorized(res: Response): Promise<boolean> {
  if (res.status !== 401) return false;
  const err = await res
    .clone()
    .json()
    .catch(() => ({}));
  const code =
    (err as ApiErrorLike)?.error?.code ??
    (typeof (err as ApiErrorLike)?.message === 'object'
      ? (err as { message?: { error?: { code?: string } } }).message?.error?.code
      : undefined);
  if (isAuthError(res.status, code) || res.status === 401) {
    forceReLogin('session');
    return true;
  }
  return false;
}

type ApiErrorLike = {
  error?: { code?: string; message?: string };
  message?: string | { error?: { code?: string } };
};

export { readApiError };
