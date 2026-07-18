import type { AuthUser } from './auth.types';

export type RequestContext = {
  user: AuthUser;
  requestId?: string;
  ip?: string;
  userAgent?: string;
};

/** Extract safe request metadata — never log bodies or PHI. */
export function requestMeta(req: {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
}): { requestId?: string; ip?: string; userAgent?: string } {
  const h = req.headers ?? {};
  const rid = h['x-request-id'] ?? h['x-correlation-id'];
  const ua = h['user-agent'];
  return {
    requestId: Array.isArray(rid) ? rid[0] : rid,
    ip: req.ip ?? req.socket?.remoteAddress,
    userAgent: Array.isArray(ua) ? ua[0] : ua,
  };
}
