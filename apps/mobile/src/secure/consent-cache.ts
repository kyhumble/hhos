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

/** Tracks patientIds with grant entries so logout can wipe them (SecureStore has no list API). */
const CONSENT_GRANT_INDEX_KEY = 'hhos.consent-grant-index';

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

async function readGrantIndex(): Promise<string[]> {
  try {
    const raw = await SecureStore.getItemAsync(CONSENT_GRANT_INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0);
  } catch {
    return [];
  }
}

async function writeGrantIndex(patientIds: string[]): Promise<void> {
  const unique = [...new Set(patientIds)];
  if (unique.length === 0) {
    try {
      await SecureStore.deleteItemAsync(CONSENT_GRANT_INDEX_KEY);
    } catch {
      // ignore
    }
    return;
  }
  await SecureStore.setItemAsync(CONSENT_GRANT_INDEX_KEY, JSON.stringify(unique));
}

async function addToGrantIndex(patientId: string): Promise<void> {
  const ids = await readGrantIndex();
  if (!ids.includes(patientId)) {
    ids.push(patientId);
    await writeGrantIndex(ids);
  }
}

async function removeFromGrantIndex(patientId: string): Promise<void> {
  const ids = await readGrantIndex();
  const next = ids.filter((id) => id !== patientId);
  if (next.length !== ids.length) {
    await writeGrantIndex(next);
  }
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
  await addToGrantIndex(entry.patientId);
}

export async function clearCachedClinicalGrant(
  patientId: string,
): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SecureKeys.consentGrant(patientId));
  } catch {
    // ignore missing keys
  }
  try {
    await removeFromGrantIndex(patientId);
  } catch {
    // ignore
  }
}

/**
 * Wipe all known clinical purpose grants (logout / session clear).
 * Architecture: consent-grant keys wipe on logout.
 */
export async function clearAllCachedClinicalGrants(): Promise<void> {
  const ids = await readGrantIndex();
  for (const patientId of ids) {
    try {
      await SecureStore.deleteItemAsync(SecureKeys.consentGrant(patientId));
    } catch {
      // ignore missing keys
    }
  }
  try {
    await SecureStore.deleteItemAsync(CONSENT_GRANT_INDEX_KEY);
  } catch {
    // ignore
  }
}
