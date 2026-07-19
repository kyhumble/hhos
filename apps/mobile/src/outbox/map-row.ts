import type { PhotoOutboxRow } from './types';

export function mapRow(row: Record<string, unknown>): PhotoOutboxRow {
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
