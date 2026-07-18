/**
 * Outbox retry backoff (architecture locked).
 * Exponential: min(15m, 2^attempt * 5s) + jitter.
 * Max attempts: 20 or 72h wall clock → dead-letter.
 */

export const MAX_ATTEMPTS = 20;
/** 72h wall-clock max age from created_at */
export const MAX_WALL_MS = 72 * 60 * 60 * 1000;
const BASE_MS = 5_000;
const CAP_MS = 15 * 60 * 1000; // 15m

/** Pure delay without jitter — for tests. */
export function backoffBaseMs(attemptCount: number): number {
  const exp = Math.max(0, attemptCount);
  const raw = Math.pow(2, exp) * BASE_MS;
  return Math.min(CAP_MS, raw);
}

/**
 * Next attempt delay with jitter in ~[base/2, base + base/2] capped at 15m.
 * `attemptCount` is the count *after* this failure is recorded.
 */
export function computeBackoffMs(
  attemptCount: number,
  random: () => number = Math.random,
): number {
  const base = backoffBaseMs(attemptCount);
  const jitter = Math.floor(random() * base);
  return Math.min(CAP_MS, Math.floor(base / 2) + jitter);
}

export function computeNextAttemptAt(
  attemptCount: number,
  now = Date.now(),
  random: () => number = Math.random,
): number {
  return now + computeBackoffMs(attemptCount, random);
}

export function isDeadLetter(
  attemptCount: number,
  createdAt: number,
  now = Date.now(),
): boolean {
  if (attemptCount >= MAX_ATTEMPTS) return true;
  if (now - createdAt >= MAX_WALL_MS) return true;
  return false;
}

/**
 * Classify HTTP/API errors for retry policy.
 * No retry: 401, 403, 409 (except caller-handled specials).
 * Retry: network, 408, 429, 5xx.
 */
export function isRetryableSyncError(err: {
  status?: number;
  code?: string;
  name?: string;
  message?: string;
}): boolean {
  const status = err.status;
  if (status === undefined || status === 0) {
    return true;
  }
  if (status === 408 || status === 429) return true;
  if (status >= 500 && status <= 599) return true;
  return false;
}

/** Codes that freeze the whole outbox (device gate). */
export function isDeviceGateCode(code: string | undefined | null): boolean {
  return code === 'DEVICE_NOT_REGISTERED' || code === 'DEVICE_REVOKED';
}

/** Codes that freeze a single item without wipe. */
export function isConsentFreezeCode(code: string | undefined | null): boolean {
  return (
    code === 'CONSENT_REVOKED' ||
    code === 'CONSENT_REQUIRED' ||
    code === 'CASELOAD_LOST'
  );
}
