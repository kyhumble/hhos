/**
 * Connectivity helpers for online-only annotate UX (K27).
 * No NetInfo dependency — uses transport-level probe against API_URL.
 */
import { API_URL } from '../config';
import { isTransportFailure } from '../api/client';

export type OnlineProbeResult =
  | { online: true }
  | { online: false; reason: 'transport' | 'probe_failed' };

/**
 * Lightweight reachability check. Any HTTP response (including 401/404) means
 * the device has transport; only fetch failures count as offline.
 * Health path is `/health` (not under /v1).
 */
export async function probeOnline(
  timeoutMs = 5_000,
): Promise<OnlineProbeResult> {
  const controller =
    typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;

  try {
    // Hit a non-PHI path; status is irrelevant — we only care about transport.
    await fetch(`${API_URL}/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      ...(controller ? { signal: controller.signal } : {}),
    });
    return { online: true };
  } catch (err) {
    if (isTransportFailure(err)) {
      return { online: false, reason: 'transport' };
    }
    // Non-transport errors (e.g. abort without network) treat as offline for safety
    return { online: false, reason: 'probe_failed' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** User-facing copy when annotate is blocked offline. */
export const ANNOTATE_OFFLINE_MESSAGE =
  'Annotations require connectivity. Reconnect to annotate this photo (no offline annotation queue).';

/** Parent photo must be available (synced) before child-DEK annotate. */
export const ANNOTATE_PARENT_NOT_AVAILABLE_MESSAGE =
  'Annotations are available only after the photo is synced (status available). Parent DEK is not required.';
