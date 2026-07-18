/**
 * Outbox row updates for the sync worker.
 */
import { getOutboxDb } from './db';
import { mapRow } from './map-row';
import {
  OutboxStatus,
  type OutboxStatusValue,
  type PhotoOutboxRow,
} from './types';

export type OutboxUpdate = {
  status?: OutboxStatusValue;
  attemptCount?: number;
  nextAttemptAt?: number | null;
  lastErrorCode?: string | null;
  serverPhotoId?: string | null;
};

export async function updateOutboxRow(
  clientPhotoId: string,
  patch: OutboxUpdate,
): Promise<void> {
  const db = await getOutboxDb();
  const now = Date.now();
  const sets: string[] = ['updated_at = ?'];
  // expo-sqlite bind values: string | number | null | boolean | Uint8Array
  const values: (string | number | null)[] = [now];

  if (patch.status !== undefined) {
    sets.push('status = ?');
    values.push(patch.status);
  }
  if (patch.attemptCount !== undefined) {
    sets.push('attempt_count = ?');
    values.push(patch.attemptCount);
  }
  if (patch.nextAttemptAt !== undefined) {
    sets.push('next_attempt_at = ?');
    values.push(patch.nextAttemptAt);
  }
  if (patch.lastErrorCode !== undefined) {
    sets.push('last_error_code = ?');
    values.push(patch.lastErrorCode);
  }
  if (patch.serverPhotoId !== undefined) {
    sets.push('server_photo_id = ?');
    values.push(patch.serverPhotoId);
  }

  values.push(clientPhotoId);
  await db.runAsync(
    `UPDATE photo_outbox SET ${sets.join(', ')} WHERE client_photo_id = ?`,
    ...values,
  );
}

/** Rows ready for a sync attempt (due by next_attempt_at). */
export async function listDueOutbox(
  now = Date.now(),
  limit = 20,
): Promise<PhotoOutboxRow[]> {
  const db = await getOutboxDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM photo_outbox
     WHERE status NOT IN ('synced', 'dead')
       AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
     ORDER BY created_at ASC
     LIMIT ?`,
    now,
    limit,
  );
  return rows.map(mapRow);
}

export async function countPendingOutbox(): Promise<number> {
  const db = await getOutboxDb();
  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM photo_outbox
     WHERE status NOT IN ('synced', 'dead')`,
  );
  return Number(row?.c ?? 0);
}

/** All outbox client ids (for revoke wipe of DEKs + cipher files). */
export async function listAllOutboxClientIds(): Promise<string[]> {
  const db = await getOutboxDb();
  const rows = await db.getAllAsync<{ client_photo_id: string }>(
    `SELECT client_photo_id FROM photo_outbox`,
  );
  return rows.map((r) => String(r.client_photo_id));
}

/** Mark every non-terminal row dead (device revoke freeze). */
export async function freezeAllOutbox(errorCode: string): Promise<void> {
  const db = await getOutboxDb();
  const now = Date.now();
  await db.runAsync(
    `UPDATE photo_outbox
     SET status = ?, last_error_code = ?, updated_at = ?, next_attempt_at = NULL
     WHERE status NOT IN ('synced', 'dead')`,
    OutboxStatus.dead,
    errorCode,
    now,
  );
}

export async function deleteOutboxRow(clientPhotoId: string): Promise<void> {
  const db = await getOutboxDb();
  await db.runAsync(
    `DELETE FROM photo_outbox WHERE client_photo_id = ?`,
    clientPhotoId,
  );
}

export { OutboxStatus };
