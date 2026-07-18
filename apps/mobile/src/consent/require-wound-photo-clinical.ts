import { fetchAndCacheActivePurposes } from '../api/consents';
import {
  ApiError,
  isAuthoritativeOnlineDenial,
  isTransportFailure,
} from '../api/client';
import {
  clearCachedClinicalGrant,
  getCachedClinicalGrant,
  type ConsentGrantCache,
} from '../secure/consent-cache';

export type CaptureGateResult =
  | { allowed: true; grant: ConsentGrantCache; source: 'cache' | 'network' }
  | {
      allowed: false;
      reason:
        | 'no_grant'
        | 'network_error'
        | 'missing_patient'
        | 'unauthorized'
        | 'forbidden';
      message: string;
    };

const NO_GRANT_MESSAGE =
  'No active WOUND_PHOTO_CLINICAL consent. Capture photo consent online (intake/SOC) before field photography. Gallery import is not allowed.';

const OFFLINE_NO_CACHE_MESSAGE =
  'Connect to capture photo consent. Offline capture requires a previously cached WOUND_PHOTO_CLINICAL grant.';

/**
 * Offline-safe gate for clinical photo capture.
 *
 * - Online success + grant → allow, cache updated
 * - Online success + no grant → clear cache, deny (revoke known)
 * - Online 401 → deny (session wiped by client)
 * - Online 403/404 → clear patient grant, deny
 * - Transport failure only → allow if non-expired cache present
 *
 * Never suggests gallery as a workaround.
 */
export async function requireWoundPhotoClinical(
  patientId: string | undefined | null,
  opts?: { refreshOnline?: boolean },
): Promise<CaptureGateResult> {
  if (!patientId) {
    return {
      allowed: false,
      reason: 'missing_patient',
      message: 'Patient is required before photo capture.',
    };
  }

  const refresh = opts?.refreshOnline !== false;

  if (refresh) {
    try {
      const { clinicalGrant } = await fetchAndCacheActivePurposes(patientId);
      if (clinicalGrant) {
        return { allowed: true, grant: clinicalGrant, source: 'network' };
      }
      // Network OK, no clinical purpose — cache already cleared by fetch helper
      return {
        allowed: false,
        reason: 'no_grant',
        message: NO_GRANT_MESSAGE,
      };
    } catch (err) {
      if (err instanceof ApiError && isAuthoritativeOnlineDenial(err.status)) {
        if (err.status === 401) {
          return {
            allowed: false,
            reason: 'unauthorized',
            message:
              'Session expired. Sign in again. Photo capture is blocked until re-authenticated.',
          };
        }
        // 403/404 — authoritative denial while online; do not honor stale cache
        await clearCachedClinicalGrant(patientId);
        return {
          allowed: false,
          reason: err.status === 403 ? 'forbidden' : 'no_grant',
          message:
            err.status === 403
              ? 'Not allowed to access this patient caseload for photo consent checks.'
              : NO_GRANT_MESSAGE,
        };
      }

      // Transport failure or non-authoritative HTTP (e.g. 5xx): cache only
      if (
        isTransportFailure(err) ||
        err instanceof ApiError ||
        err instanceof Error
      ) {
        const cached = await getCachedClinicalGrant(patientId);
        if (cached) {
          return { allowed: true, grant: cached, source: 'cache' };
        }
        return {
          allowed: false,
          reason: 'network_error',
          message: OFFLINE_NO_CACHE_MESSAGE,
        };
      }

      return {
        allowed: false,
        reason: 'network_error',
        message: OFFLINE_NO_CACHE_MESSAGE,
      };
    }
  }

  // Explicit offline-only path (refreshOnline: false)
  const cached = await getCachedClinicalGrant(patientId);
  if (cached) {
    return { allowed: true, grant: cached, source: 'cache' };
  }

  return {
    allowed: false,
    reason: 'no_grant',
    message: NO_GRANT_MESSAGE,
  };
}
