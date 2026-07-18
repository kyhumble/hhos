/**
 * Local PHI wipe helpers for sync complete + device revoke.
 * Purges DEK Secure Store keys + cipher files (+ optional outbox rows).
 */
import { clearPhotoDek } from '../secure/photo-dek-store';
import { deleteCipherFile } from './cipher-fs';
import {
  deleteOutboxRow,
  freezeAllOutbox,
  listAllOutboxClientIds,
  updateOutboxRow,
} from './repository';
import { OutboxStatus } from './types';

/**
 * After successful complete: wipe DEK + cipher file; mark row synced.
 */
export async function wipeAfterSynced(clientPhotoId: string): Promise<void> {
  await clearPhotoDek(clientPhotoId);
  await deleteCipherFile(clientPhotoId);
  await updateOutboxRow(clientPhotoId, {
    status: OutboxStatus.synced,
    lastErrorCode: null,
    nextAttemptAt: null,
  });
}

/**
 * DEVICE_REVOKED / local wipe: purge FS ciphertext + DEKs for all outbox ids,
 * freeze remaining queue as dead.
 */
export async function wipeLocalOnDeviceRevoke(): Promise<void> {
  const ids = await listAllOutboxClientIds();
  for (const clientPhotoId of ids) {
    await clearPhotoDek(clientPhotoId);
    await deleteCipherFile(clientPhotoId);
  }
  await freezeAllOutbox('DEVICE_REVOKED');
}

/**
 * Abandon a single local item (server 410 / soft-delete mid-flight).
 * Removes DEK + cipher + outbox row.
 */
export async function abandonLocalPhoto(clientPhotoId: string): Promise<void> {
  await clearPhotoDek(clientPhotoId);
  await deleteCipherFile(clientPhotoId);
  await deleteOutboxRow(clientPhotoId);
}

/**
 * Dead-letter purge of secrets while keeping the dead row for diagnostics.
 */
export async function purgeSecretsForDead(
  clientPhotoId: string,
): Promise<void> {
  await clearPhotoDek(clientPhotoId);
  await deleteCipherFile(clientPhotoId);
}
