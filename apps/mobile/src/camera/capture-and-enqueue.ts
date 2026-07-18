/**
 * Clinical capture pipeline: normalize JPEG → AES-GCM encrypt → outbox enqueue.
 * App-controlled camera URI only — never gallery import.
 */
import * as ExpoCrypto from 'expo-crypto';
import {
  aesGcmEncrypt,
  bufferToBase64,
  base64ToBuffer,
  generatePhotoDek,
  sha256Hex,
} from '../crypto/aes-gcm';
import { CLINICAL_PHOTO_PURPOSE } from '../clinical-purpose';
import { writeCipherFile, deleteCipherFile } from '../outbox/cipher-fs';
import { enqueuePhotoOutbox } from '../outbox/enqueue';
import type { OutboxMetaJson, PhotoOutboxRow } from '../outbox/types';
import { setPhotoDek, clearPhotoDek } from '../secure/photo-dek-store';
import {
  assertCameraCaptureUri,
  cleanupPlaintextUri,
} from './camera-uri';
import { normalizeJpeg } from './normalize-jpeg';

export type CaptureAndEnqueueInput = {
  /** Local file URI from expo-camera takePictureAsync only */
  cameraImageUri: string;
  patientId: string;
  episodeId: string;
  consentRecordId: string;
  woundId?: string | null;
  visitId?: string | null;
  /** Device clock at shutter (defaults to now) */
  capturedAt?: string;
};

export type CaptureAndEnqueueResult = {
  clientPhotoId: string;
  plaintextSha256: string;
  cipherSha256: string;
  byteSize: number;
  widthPx: number;
  heightPx: number;
  outbox: PhotoOutboxRow;
};

export { cleanupPlaintextUri } from './camera-uri';

/**
 * Encrypt-before-outbox: DEK in Secure Store, ciphertext on FS, IDs in sqlite.
 * Rolls back DEK + cipher file if sqlite insert fails.
 * Always best-effort deletes camera + manipulator plaintext temps (success or failure).
 */
export async function captureEncryptAndEnqueue(
  input: CaptureAndEnqueueInput,
): Promise<CaptureAndEnqueueResult> {
  if (!input.cameraImageUri) {
    throw new Error('CAMERA_URI_REQUIRED');
  }

  let normalizedUri: string | null = null;

  try {
    // Strict allowlist: app sandbox file:// only (not gallery denylist)
    assertCameraCaptureUri(input.cameraImageUri);

    const normalized = await normalizeJpeg(input.cameraImageUri);
    normalizedUri = normalized.uri;

    // Manipulator output must also stay inside app sandbox
    assertCameraCaptureUri(normalized.uri);

    const plaintext = base64ToBuffer(normalized.base64);
    const plaintextSha256 = sha256Hex(plaintext);

    const clientPhotoId = ExpoCrypto.randomUUID();
    const dek = generatePhotoDek();
    const dekBase64 = bufferToBase64(dek);

    const { framed } = aesGcmEncrypt(plaintext, dek);
    const cipherSha256 = sha256Hex(framed);
    const byteSize = framed.length;
    const framedBase64 = bufferToBase64(framed);

    await setPhotoDek(clientPhotoId, dekBase64);

    let localCipherPath: string;
    try {
      localCipherPath = await writeCipherFile(clientPhotoId, framedBase64);
    } catch (err) {
      await clearPhotoDek(clientPhotoId);
      throw err;
    }

    const capturedAt = input.capturedAt ?? new Date().toISOString();
    const meta: OutboxMetaJson = {
      contentType: 'image/jpeg',
      widthPx: normalized.width,
      heightPx: normalized.height,
      capturedAt,
      captureSource: 'app_camera',
      purposeCode: CLINICAL_PHOTO_PURPOSE,
    };

    let outbox: PhotoOutboxRow;
    try {
      outbox = await enqueuePhotoOutbox({
        clientPhotoId,
        patientId: input.patientId,
        episodeId: input.episodeId,
        woundId: input.woundId,
        visitId: input.visitId,
        consentRecordId: input.consentRecordId,
        localCipherPath,
        plaintextSha256,
        cipherSha256,
        byteSize,
        meta,
      });
    } catch (err) {
      await deleteCipherFile(clientPhotoId);
      await clearPhotoDek(clientPhotoId);
      throw err;
    }

    return {
      clientPhotoId,
      plaintextSha256,
      cipherSha256,
      byteSize,
      widthPx: normalized.width,
      heightPx: normalized.height,
      outbox,
    };
  } finally {
    // Wipe plaintext temps on every path: success, size reject, encrypt fail, etc.
    // Idempotent — safe if already deleted or missing.
    await cleanupPlaintextUri(normalizedUri);
    await cleanupPlaintextUri(input.cameraImageUri);
  }
}
