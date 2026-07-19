import { clearAllCachedClinicalGrants } from '../secure/consent-cache';
import { clearAccessToken, setAccessToken } from '../secure/token-store';
import { apiRequest } from './client';

export type DevLoginUser = {
  id: string;
  orgId: string;
  email: string;
  fullName: string;
  roles: string[];
  permissions: string[];
};

export type DevLoginResponse = {
  accessToken: string;
  tokenType: string;
  user: DevLoginUser;
  error?: { code: string; message: string };
};

/**
 * Clear session secrets: JWT + all known consent-grant caches.
 * Call on logout and when the server rejects the token (401).
 */
export async function clearSession(): Promise<void> {
  await clearAccessToken();
  await clearAllCachedClinicalGrants();
}

export async function devLogin(email: string): Promise<DevLoginResponse> {
  const data = await apiRequest<DevLoginResponse>('/v1/auth/dev-login', {
    method: 'POST',
    body: { email },
    skipAuth: true,
  });
  if (data.error || !data.accessToken) {
    throw new Error(data.error?.message ?? 'Login failed');
  }
  await setAccessToken(data.accessToken);
  return data;
}

export async function logout(): Promise<void> {
  await clearSession();
}

export async function fetchMe(): Promise<{ user: DevLoginUser }> {
  return apiRequest('/v1/me');
}
