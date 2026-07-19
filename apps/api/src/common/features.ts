/**
 * Feature-flag helpers (K12) + multi-tenant org overrides.
 *
 * Platform env FEATURE_* is a hard kill switch (must be on for any tenant).
 * Org settings.features.* can further disable a module per agency.
 * Env values accepted as true: "1", "true", "yes" (case-insensitive).
 */

export type OrgFeatureSlice = {
  features?: {
    woundPhotos?: boolean;
    oasis?: boolean;
    serviceAi?: boolean;
    ordersEsign?: boolean;
    hospice?: boolean;
    billing?: boolean;
  };
} | null | undefined;

export function featureEnabled(name: string, defaultValue = false): boolean {
  const v = process.env[name];
  if (v === undefined || v === '') return defaultValue;
  const lower = v.toLowerCase();
  return v === '1' || lower === 'true' || lower === 'yes';
}

/**
 * Platform kill switch AND optional per-org toggle.
 * If org flag is explicitly false → off. Undefined → inherit platform.
 */
export function isFeatureEnabledForOrg(
  envName: string,
  orgFlag: boolean | undefined,
  platformDefault = false,
): boolean {
  if (!featureEnabled(envName, platformDefault)) return false;
  if (orgFlag === false) return false;
  return true;
}

/** Master API switch for wound-photo routes and control plane. */
export function isWoundPhotosEnabled(org?: OrgFeatureSlice): boolean {
  return isFeatureEnabledForOrg(
    'FEATURE_WOUND_PHOTOS',
    org?.features?.woundPhotos,
    false,
  );
}

/** Master API switch for OASIS-E2 / PDGM advisory routes. */
export function isOasisEnabled(org?: OrgFeatureSlice): boolean {
  return isFeatureEnabledForOrg('FEATURE_OASIS', org?.features?.oasis, false);
}

/** Master switch for Service AI routing / visit tasks / hospitalization alerts. */
export function isServiceAiEnabled(org?: OrgFeatureSlice): boolean {
  return isFeatureEnabledForOrg(
    'FEATURE_SERVICE_AI',
    org?.features?.serviceAi,
    false,
  );
}

/** Orders / 485 / physician e-sign workflow. */
export function isOrdersEsignEnabled(org?: OrgFeatureSlice): boolean {
  return isFeatureEnabledForOrg(
    'FEATURE_ORDERS_ESIGN',
    org?.features?.ordersEsign,
    false,
  );
}

/** Hospice elections, LOC, benefit periods. */
export function isHospiceEnabled(org?: OrgFeatureSlice): boolean {
  return isFeatureEnabledForOrg('FEATURE_HOSPICE', org?.features?.hospice, false);
}

/** Billing readiness and claim export packages. */
export function isBillingEnabled(org?: OrgFeatureSlice): boolean {
  return isFeatureEnabledForOrg('FEATURE_BILLING', org?.features?.billing, false);
}

/**
 * Geotag env gate (K8 / K26) — fail-closed.
 * Only explicit `true` / `1` enables; unset, empty, or other values = off.
 * Callers must still AND with org.settings.photoGeotagEnabled.
 */
export function isPhotoGeotagEnvEnabled(): boolean {
  const v = process.env.PHOTO_GEOTAG_ENABLED;
  if (v === undefined || v === '') return false;
  return v === '1' || v.toLowerCase() === 'true';
}
