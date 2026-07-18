import { CLINICAL_PHOTO_PURPOSE } from '../config';
import {
  setCachedClinicalGrant,
  type ConsentGrantCache,
} from '../secure/consent-cache';
import { apiRequest } from './client';

export type ActivePurposesResponse = {
  patientId: string;
  purposes: string[];
  grants: {
    purposeCode: string;
    consentRecordId: string;
    consentType: string;
  }[];
};

/**
 * Fetch active purposes for a patient and cache WOUND_PHOTO_CLINICAL grant
 * (IDs only) under `hhos.consent-grant.{patientId}`.
 */
export async function fetchAndCacheActivePurposes(
  patientId: string,
): Promise<{
  response: ActivePurposesResponse;
  clinicalGrant: ConsentGrantCache | null;
}> {
  const response = await apiRequest<ActivePurposesResponse>(
    `/v1/patients/${encodeURIComponent(patientId)}/active-purposes`,
  );

  const grant = response.grants?.find(
    (g) => g.purposeCode === CLINICAL_PHOTO_PURPOSE,
  );

  if (grant) {
    const clinicalGrant: ConsentGrantCache = {
      patientId,
      consentRecordId: grant.consentRecordId,
      purpose: CLINICAL_PHOTO_PURPOSE,
      fetchedAt: new Date().toISOString(),
      expiresAt: null,
    };
    await setCachedClinicalGrant(clinicalGrant);
    return { response, clinicalGrant };
  }

  return { response, clinicalGrant: null };
}
