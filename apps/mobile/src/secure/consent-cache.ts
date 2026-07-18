import * as SecureStore from 'expo-secure-store';
import {
  CLINICAL_PHOTO_PURPOSE,
  CONSENT_GRANT_TTL_MS,
} from '../config';
import { SecureKeys } from './keys';

/**
 * Cached clinical photo purpose grant — IDs only, no PHI names.
 * Key: `hhos.consent-grant.{patientId}`
 */
export type ConsentGrantCache = {
  patientId: string;
  consentRecordId: string;
  purpose: typeof CLINICAL_PHOTO_PURPOSE;
  fetchedAt: string; // ISO
  expiresAt?: string | null;
};

function isExpired(entry: ConsentGrantCache, now = Date.now()): boolean {
  const fetched = Date.parse(entry.fetchedAt);
  if (Number.isNaN(fetched)) return true;
  if (now - fetched > CONSENT_GRANT_TTL_MS) return true;
  if (entry.expiresAt) {
    const exp = Date.parse(entry.expiresAt);
    if (!Number.isNaN(exp) && exp <= now) return true;
  }
  return false;
}

export async function getCachedClinicalGrant(
  patientId: string,
): Promise<ConsentGrantCache | null> {
  try {
    const raw = await SecureStore.getItemAsync(
      SecureKeys.consentGrant(patientId),
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentGrantCache;
    if (
      !parsed?.consentRecordId ||
      parsed.purpose !== CLINICAL_PHOTO_PURPOSE ||
      parsed.patientId !== patientId
    ) {
      return null;
    }
    if (isExpired(parsed)) {
      await clearCachedClinicalGrant(patientId);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function setCachedClinicalGrant(
  entry: ConsentGrantCache,
): Promise<void> {
  await SecureStore.setItemAsync(
    SecureKeys.consentGrant(entry.patientId),
    JSON.stringify(entry),
  );
}

export async function clearCachedClinicalGrant(
  patientId: string,
): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SecureKeys.consentGrant(patientId));
  } catch {
    // ignore missing keys
  }
}
