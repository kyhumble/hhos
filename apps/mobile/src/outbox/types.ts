/**
 * Device-local photo outbox row (IDs/status only — no names, geo, or DEKs).
 * @see docs/architecture/phase-2-secure-wound-photos.md photo_outbox
 */

export const OutboxStatus = {
  pending_wrap: 'pending_wrap',
  pending_upload: 'pending_upload',
  uploading: 'uploading',
  pending_complete: 'pending_complete',
  synced: 'synced',
  failed: 'failed',
  dead: 'dead',
} as const;

export type OutboxStatusValue =
  (typeof OutboxStatus)[keyof typeof OutboxStatus];

/** Structured codes only in meta_json — never DEKs or patient names. */
export type OutboxMetaJson = {
  contentType: 'image/jpeg';
  widthPx?: number;
  heightPx?: number;
  capturedAt: string;
  captureSource: 'app_camera';
  purposeCode: 'WOUND_PHOTO_CLINICAL';
};

export type PhotoOutboxRow = {
  clientPhotoId: string;
  patientId: string;
  episodeId: string;
  woundId: string | null;
  visitId: string | null;
  consentRecordId: string;
  localCipherPath: string;
  plaintextSha256: string;
  cipherSha256: string;
  byteSize: number;
  metaJson: string;
  status: OutboxStatusValue;
  attemptCount: number;
  nextAttemptAt: number | null;
  lastErrorCode: string | null;
  serverPhotoId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type EnqueuePhotoInput = {
  clientPhotoId: string;
  patientId: string;
  episodeId: string;
  woundId?: string | null;
  visitId?: string | null;
  consentRecordId: string;
  localCipherPath: string;
  plaintextSha256: string;
  cipherSha256: string;
  byteSize: number;
  meta: OutboxMetaJson;
};
