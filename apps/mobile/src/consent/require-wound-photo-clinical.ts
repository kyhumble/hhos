import { fetchAndCacheActivePurposes } from '../api/consents';
import {
  getCachedClinicalGrant,
  type ConsentGrantCache,
} from '../secure/consent-cache';

export type CaptureGateResult =
  | { allowed: true; grant: ConsentGrantCache; source: 'cache' | 'network' }
  | {
      allowed: false;
      reason: 'no_grant' | 'network_error' | 'missing_patient';
      message: string;
    };

/**
 * Offline-safe gate for clinical photo capture.
 * Allows only when a non-expired WOUND_PHOTO_CLINICAL grant is cached
 * (or freshly fetched). Never suggests gallery as a workaround.
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
      // Network succeeded but no clinical purpose — fall through to cache check
      // then hard-deny if still missing.
    } catch {
      // Offline / API failure — use cache only
      const cached = await getCachedClinicalGrant(patientId);
      if (cached) {
        return { allowed: true, grant: cached, source: 'cache' };
      }
      return {
        allowed: false,
        reason: 'network_error',
        message:
          'Connect to capture photo consent. Offline capture requires a previously cached WOUND_PHOTO_CLINICAL grant.',
      };
    }
  }

  const cached = await getCachedClinicalGrant(patientId);
  if (cached) {
    return { allowed: true, grant: cached, source: 'cache' };
  }

  return {
    allowed: false,
    reason: 'no_grant',
    message:
      'No active WOUND_PHOTO_CLINICAL consent. Capture photo consent online (intake/SOC) before field photography. Gallery import is not allowed.',
  };
}
