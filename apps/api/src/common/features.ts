/**
 * Feature-flag helpers (K12).
 * Env values accepted as true: "1", "true", "yes" (case-insensitive).
 * Missing / empty → defaultValue (FEATURE_WOUND_PHOTOS defaults false).
 *
 * Reserved flags in `.env.example` without dedicated helpers yet (use featureEnabled):
 *   FEATURE_PHOTO_ANNOTATIONS, FEATURE_LARGE_WOUND_TASKS, FEATURE_PHOTO_BYTES_VIA_API
 * Thin helpers land with the routes that consume them (PR 5b+).
 */

export function featureEnabled(name: string, defaultValue = false): boolean {
  const v = process.env[name];
  if (v === undefined || v === '') return defaultValue;
  const lower = v.toLowerCase();
  return v === '1' || lower === 'true' || lower === 'yes';
}

/** Master API switch for wound-photo routes and control plane. */
export function isWoundPhotosEnabled(): boolean {
  return featureEnabled('FEATURE_WOUND_PHOTOS', false);
}

/** Master API switch for OASIS-E2 / PDGM advisory routes. */
export function isOasisEnabled(): boolean {
  return featureEnabled('FEATURE_OASIS', false);
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
