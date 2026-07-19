/**
 * Runtime config for the field app.
 * Prefer EXPO_PUBLIC_API_URL; otherwise localhost (device builds need LAN IP via env).
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

/** Consent purpose grant cache TTL (locked: 7 days). */
export const CONSENT_GRANT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Clinical capture purpose — must match `@hhos/shared` PurposeCode. */
export { CLINICAL_PHOTO_PURPOSE } from './clinical-purpose';
