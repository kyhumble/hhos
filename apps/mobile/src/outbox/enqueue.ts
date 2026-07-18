/**
 * Enqueue an encrypted photo into the local outbox.
 * DEK must already be in Secure Store under hhos.photo-dek.{clientPhotoId}.
 */
import { getOutboxDb } from './db';
import {
  OutboxStatus,
  type EnqueuePhotoInput,
  type PhotoOutboxRow,
} from './types';

export async function enqueuePhotoOutbox(
  input: EnqueuePhotoInput,
): Promise<PhotoOutboxRow> {
  const db = await getOutboxDb();
  const now = Date.now();
  const metaJson = JSON.stringify(input.meta);

  // Guard: refuse if meta somehow included DEK-like fields
  if (
    /dek/i.test(metaJson) ||
    metaJson.includes('wrapped') ||
    metaJson.includes('privateKey')
  ) {
    throw new Error('OUTBOX_META_MUST_NOT_CONTAIN_SECRETS');
  }

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

function mapRow(row: Record<string, unknown>): PhotoOutboxRow {
  return {
    clientPhotoId: String(row.client_photo_id),
    patientId: String(row.patient_id),
    episodeId: String(row.episode_id),
    woundId: row.wound_id != null ? String(row.wound_id) : null,
    visitId: row.visit_id != null ? String(row.visit_id) : null,
    consentRecordId: String(row.consent_record_id),
    localCipherPath: String(row.local_cipher_path),
    plaintextSha256: String(row.plaintext_sha256),
    cipherSha256: String(row.cipher_sha256),
    byteSize: Number(row.byte_size),
    metaJson: String(row.meta_json),
    status: String(row.status) as PhotoOutboxRow['status'],
    attemptCount: Number(row.attempt_count ?? 0),
    nextAttemptAt:
      row.next_attempt_at != null ? Number(row.next_attempt_at) : null,
    lastErrorCode:
      row.last_error_code != null ? String(row.last_error_code) : null,
    serverPhotoId:
      row.server_photo_id != null ? String(row.server_photo_id) : null,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}
