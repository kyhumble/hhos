/**
 * Enqueue an encrypted photo into the local outbox.
 * DEK must already be in Secure Store under hhos.photo-dek.{clientPhotoId}.
 */
import { getOutboxDb } from './db';
import { mapRow } from './map-row';
import {
  OutboxStatus,
  type EnqueuePhotoInput,
  type OutboxMetaJson,
  type PhotoOutboxRow,
} from './types';

/** Only these keys may appear in meta_json (typed OutboxMetaJson). */
const ALLOWED_META_KEYS = new Set<keyof OutboxMetaJson>([
  'contentType',
  'widthPx',
  'heightPx',
  'capturedAt',
  'captureSource',
  'purposeCode',
]);

/**
 * Serialize meta after verifying only allowlisted keys are present.
 * Prefer typed OutboxMetaJson over string heuristics for secret names.
 */
export function serializeOutboxMeta(meta: OutboxMetaJson): string {
  const keys = Object.keys(meta) as (keyof OutboxMetaJson)[];
  for (const key of keys) {
    if (!ALLOWED_META_KEYS.has(key)) {
      throw new Error('OUTBOX_META_UNEXPECTED_KEY');
    }
  }
  if (meta.contentType !== 'image/jpeg') {
    throw new Error('OUTBOX_META_INVALID_CONTENT_TYPE');
  }
  if (meta.captureSource !== 'app_camera') {
    throw new Error('OUTBOX_META_INVALID_CAPTURE_SOURCE');
  }
  if (meta.purposeCode !== 'WOUND_PHOTO_CLINICAL') {
    throw new Error('OUTBOX_META_INVALID_PURPOSE');
  }
  return JSON.stringify(meta);
}

export async function enqueuePhotoOutbox(
  input: EnqueuePhotoInput,
): Promise<PhotoOutboxRow> {
  const db = await getOutboxDb();
  const now = Date.now();
  const metaJson = serializeOutboxMeta(input.meta);

  await db.runAsync(
    `INSERT INTO photo_outbox (
      client_photo_id, patient_id, episode_id, wound_id, visit_id,
      consent_record_id, local_cipher_path, plaintext_sha256, cipher_sha256,
      byte_size, meta_json, status, attempt_count, next_attempt_at,
      last_error_code, server_photo_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, NULL, ?, ?)`,
    input.clientPhotoId,
    input.patientId,
    input.episodeId,
    input.woundId ?? null,
    input.visitId ?? null,
    input.consentRecordId,
    input.localCipherPath,
    input.plaintextSha256,
    input.cipherSha256,
    input.byteSize,
    metaJson,
    OutboxStatus.pending_wrap,
    now,
    now,
  );

  return {
    clientPhotoId: input.clientPhotoId,
    patientId: input.patientId,
    episodeId: input.episodeId,
    woundId: input.woundId ?? null,
    visitId: input.visitId ?? null,
    consentRecordId: input.consentRecordId,
    localCipherPath: input.localCipherPath,
    plaintextSha256: input.plaintextSha256,
    cipherSha256: input.cipherSha256,
    byteSize: input.byteSize,
    metaJson,
    status: OutboxStatus.pending_wrap,
    attemptCount: 0,
    nextAttemptAt: null,
    lastErrorCode: null,
    serverPhotoId: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getOutboxRow(
  clientPhotoId: string,
): Promise<PhotoOutboxRow | null> {
  const db = await getOutboxDb();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM photo_outbox WHERE client_photo_id = ?`,
    clientPhotoId,
  );
  if (!row) return null;
  return mapRow(row);
}

export async function listPendingOutbox(
  limit = 50,
): Promise<PhotoOutboxRow[]> {
  const db = await getOutboxDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM photo_outbox
     WHERE status NOT IN ('synced', 'dead')
     ORDER BY created_at ASC
     LIMIT ?`,
    limit,
  );
  return rows.map(mapRow);
}
