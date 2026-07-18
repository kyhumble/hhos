/**
 * Secure Store key layout (Phase 2 locked).
 * @see docs/architecture/phase-2-secure-wound-photos.md
 */
export const SecureKeys = {
  accessToken: 'hhos.accessToken',
  deviceId: 'hhos.deviceId',
  /** Per-patient cached clinical purpose grant (IDs only). */
  consentGrant: (patientId: string) => `hhos.consent-grant.${patientId}`,
  /** Per pending photo DEK — used in PR 9+. */
  photoDek: (clientPhotoId: string) => `hhos.photo-dek.${clientPhotoId}`,
  /** Per in-flight annotation DEK — used later. */
  annotDek: (clientAnnotationId: string) =>
    `hhos.annot-dek.${clientAnnotationId}`,
} as const;
