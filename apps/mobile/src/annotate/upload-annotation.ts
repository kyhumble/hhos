/**
 * Online-only annotation upload with **child DEK** (K9 / K27).
 *
 * Flow: generate child DEK → encrypt → Secure Store annot-dek →
 *   ensureDeviceRegistered → initiate → wrap-dek → PUT (URL as returned) → complete → wipe DEK.
 *
 * **No annotation_outbox** — failures do not queue offline; caller must retry while online.
 * Parent photo must already be `available` (server enforces PARENT_NOT_AVAILABLE).
 * Does not require parent photo DEK on device.
 */
import * as ExpoCrypto from 'expo-crypto';
import type { DeviceInfo } from '@hhos/shared';
import { ApiError, isTransportFailure } from '../api/client';
import {
  completeAnnotationUpload,
  initiateAnnotationUpload,
  putPresignedCipher,
  wrapAnnotationDek,
} from '../api/wound-photos';
import {
  aesGcmEncrypt,
  bufferToBase64,
  generatePhotoDek,
  sha256Hex,
} from '../crypto/aes-gcm';
import { ensureDeviceRegistered } from '../device/register';
import { buildDeviceInfo } from '../device/device-info';
import { clearAnnotDek, setAnnotDek } from '../secure/annot-dek-store';
import { getOrCreateDeviceId } from '../secure/device-id';
import { ANNOTATE_OFFLINE_MESSAGE, probeOnline } from './online';
import {
  buildVectorJsonBytes,
  isNonEmptyAnnotation,
  type VectorMarker,
  type VectorStroke,
} from './vector-payload';

export type UploadVectorAnnotationInput = {
  woundPhotoId: string;
  strokes?: VectorStroke[];
  markers?: VectorMarker[];
};

export type UploadVectorAnnotationResult = {
  annotationId: string;
  clientAnnotationId: string;
  status: string;
  byteSize: number;
  cipherSha256: string;
};

/**
 * Encrypt vector_json and upload online. Throws with code ANNOTATE_OFFLINE if not connected.
 */
export async function uploadVectorAnnotationOnline(
  input: UploadVectorAnnotationInput,
): Promise<UploadVectorAnnotationResult> {
  const strokes = input.strokes ?? [];
  const markers = input.markers ?? [];
  if (!isNonEmptyAnnotation(strokes, markers)) {
    throw new Error('ANNOTATION_EMPTY');
  }

  // Hard gate: no offline queue
  const online = await probeOnline();
  if (!online.online) {
    const err = new Error(ANNOTATE_OFFLINE_MESSAGE) as Error & {
      code: string;
    };
    err.code = 'ANNOTATE_OFFLINE';
    throw err;
  }

  // Device register gate (same as photo uploads)
  await ensureDeviceRegistered();
  const deviceId = await getOrCreateDeviceId();
  const device: DeviceInfo = buildDeviceInfo(deviceId);

  const plaintext = buildVectorJsonBytes({ strokes, markers });
  const clientAnnotationId = ExpoCrypto.randomUUID();
  const dek = generatePhotoDek();
  const dekBase64 = bufferToBase64(dek);
  const { framed } = aesGcmEncrypt(plaintext, dek);
  const cipherSha256 = sha256Hex(framed);
  const byteSize = framed.length;

  await setAnnotDek(clientAnnotationId, dekBase64);

  try {
    const initiated = await initiateAnnotationUpload(input.woundPhotoId, {
      clientAnnotationId,
      annotationType: 'vector_json',
      contentType: 'application/json',
      byteSize,
      device,
    });

    if (initiated.status === 'available') {
      // Idempotent replay of already-complete annotation
      await clearAnnotDek(clientAnnotationId);
      return {
        annotationId: initiated.id,
        clientAnnotationId,
        status: initiated.status,
        byteSize,
        cipherSha256,
      };
    }

    // wrap-dek (single-use; DEK_ALREADY_WRAPPED is resume-ok)
    try {
      await wrapAnnotationDek(initiated.id, { dekBase64 });
    } catch (err) {
      if (!(err instanceof ApiError) || err.code !== 'DEK_ALREADY_WRAPPED') {
        throw err;
      }
    }

    let putUrl = initiated.presignedPutUrl;
    if (!putUrl) {
      // Re-initiate for fresh presign if wrap already done without URL
      const again = await initiateAnnotationUpload(input.woundPhotoId, {
        clientAnnotationId,
        annotationType: 'vector_json',
        contentType: 'application/json',
        byteSize,
        device,
      });
      putUrl = again.presignedPutUrl;
    }
    if (!putUrl) {
      throw new ApiError(
        409,
        'PRESIGN_MISSING',
        'No presigned URL for annotation upload',
      );
    }

    // K25: use URL as returned — do not rewrite host
    await putPresignedCipher(putUrl, framed, byteSize);

    const completed = await completeAnnotationUpload(initiated.id, {
      clientAnnotationId,
      cipherSha256,
      byteSize,
    });

    await clearAnnotDek(clientAnnotationId);

    return {
      annotationId: completed.id,
      clientAnnotationId,
      status: completed.status,
      byteSize,
      cipherSha256,
    };
  } catch (err) {
    await clearAnnotDek(clientAnnotationId);
    if (isTransportFailure(err)) {
      const offline = new Error(ANNOTATE_OFFLINE_MESSAGE) as Error & {
        code: string;
      };
      offline.code = 'ANNOTATE_OFFLINE';
      throw offline;
    }
    throw err;
  }
}
