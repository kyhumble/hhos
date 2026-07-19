/**
 * Client-side auth session for the ops console.
 * Token + user (roles/permissions) from dev-login or GET /v1/me.
 */
import { Permission, type PermissionCode, type RoleCode } from '@hhos/shared';
import { API_URL, authHeaders, getToken } from './api';

export type SessionUser = {
  id: string;
  orgId: string;
  email: string;
  fullName: string;
  roles: RoleCode[];
  permissions: PermissionCode[];
};

const USER_KEY = 'hhos_user';

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
  window.localStorage.setItem('hhos_token', token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem('hhos_token');
  window.localStorage.removeItem(USER_KEY);
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
 */
export async function loadSessionUser(): Promise<SessionUser | null> {
  const token = getToken();
  if (!token) return null;

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
