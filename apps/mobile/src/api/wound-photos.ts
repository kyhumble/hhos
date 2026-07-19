import type {
  CompleteWoundPhotoUploadInput,
  DeviceInfo,
  InitiateWoundPhotoUploadInput,
  WrapDekInput,
} from '@hhos/shared';
import { apiRequest } from './client';

export type InitiateUploadResponse = {
  id: string;
  clientPhotoId: string;
  status: string;
  storageKey?: string | null;
  /** Device-facing signed URL — use as returned; do not rewrite host. */
  presignedPutUrl?: string;
  expiresAt?: string;
  _idempotentReplay?: boolean;
};

export type WrapDekResponse = {
  id: string;
  clientPhotoId: string;
  status: string;
  kekKeyId?: string | null;
};

export type CompleteUploadResponse = {
  id: string;
  clientPhotoId: string;
  status: string;
  isLargeWound?: boolean;
  uploadedAt?: string | null;
};

export type InitiatePhotoParams = {
  clientPhotoId: string;
  patientId: string;
  episodeId: string;
  woundId: string;
  visitId?: string | null;
  consentRecordId: string;
  capturedAt: string;
  byteSize: number;
  plaintextSha256: string;
  widthPx?: number;
  heightPx?: number;
  device: DeviceInfo;
};

/**
 * POST /v1/wound-photos/uploads
 * Idempotency-Key equals clientPhotoId.
 */
export async function initiateWoundPhotoUpload(
  params: InitiatePhotoParams,
): Promise<InitiateUploadResponse> {
  const body: InitiateWoundPhotoUploadInput = {
    clientPhotoId: params.clientPhotoId,
    patientId: params.patientId,
    episodeId: params.episodeId,
    woundId: params.woundId,
    ...(params.visitId ? { visitId: params.visitId } : {}),
    consentRecordId: params.consentRecordId,
    capturedAt: params.capturedAt,
    contentType: 'image/jpeg',
    byteSize: params.byteSize,
    plaintextSha256: params.plaintextSha256,
    ...(params.widthPx !== undefined ? { widthPx: params.widthPx } : {}),
    ...(params.heightPx !== undefined ? { heightPx: params.heightPx } : {}),
    device: params.device,
    captureSource: 'app_camera',
    purposeCode: 'WOUND_PHOTO_CLINICAL',
  };

  return apiRequest<InitiateUploadResponse>('/v1/wound-photos/uploads', {
    method: 'POST',
    body,
    headers: {
      'Idempotency-Key': params.clientPhotoId,
    },
  });
}

/**
 * POST /v1/wound-photos/:id/wrap-dek
 * Never log dekBase64.
 */
export async function wrapWoundPhotoDek(
  photoId: string,
  input: WrapDekInput,
): Promise<WrapDekResponse> {
  return apiRequest<WrapDekResponse>(`/v1/wound-photos/${photoId}/wrap-dek`, {
    method: 'POST',
    body: input,
  });
}

/**
 * POST /v1/wound-photos/:id/complete
 */
export async function completeWoundPhotoUpload(
  photoId: string,
  input: CompleteWoundPhotoUploadInput,
): Promise<CompleteUploadResponse> {
  return apiRequest<CompleteUploadResponse>(
    `/v1/wound-photos/${photoId}/complete`,
    {
      method: 'POST',
      body: input,
    },
  );
}

/**
 * PUT ciphertext to the presigned URL **as returned** (K25 — no host rewrite).
 * Content-Type must match initiate sign: application/octet-stream.
 */
export async function putPresignedCipher(
  presignedPutUrl: string,
  body: ArrayBuffer | Uint8Array,
  byteSize: number,
): Promise<void> {
  const res = await fetch(presignedPutUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(byteSize),
    },
    body: body as BodyInit,
  });

  if (!res.ok) {
    const err = new Error(`PRESIGNED_PUT_FAILED:${res.status}`) as Error & {
      status: number;
      code: string;
    };
    err.status = res.status;
    err.code =
      res.status >= 500 || res.status === 408 || res.status === 429
        ? 'PRESIGNED_PUT_RETRYABLE'
        : 'PRESIGNED_PUT_FAILED';
    throw err;
  }
}
