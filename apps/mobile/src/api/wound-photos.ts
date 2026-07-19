import type {
  CompleteAnnotationUploadInput,
  CompleteWoundPhotoUploadInput,
  DeviceInfo,
  InitiateAnnotationUploadInput,
  InitiateWoundPhotoUploadInput,
  PatchWoundPhotoMeasurementsInput,
  WrapDekInput,
} from '@hhos/shared';
import { API_URL } from '../config';
import { getAccessToken } from '../secure/token-store';
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
  clientPhotoId?: string;
  clientAnnotationId?: string;
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

export type WoundPhotoMetadata = {
  id: string;
  orgId: string;
  patientId: string;
  episodeId: string;
  woundId: string;
  visitId?: string | null;
  consentRecordId: string;
  clientPhotoId: string;
  status: string;
  capturedAt: string;
  lengthCm?: number | null;
  widthCm?: number | null;
  depthCm?: number | null;
  measurementMethod?: string | null;
  isLargeWound?: boolean;
  widthPx?: number | null;
  heightPx?: number | null;
  uploadedAt?: string | null;
  hasWrappedDek?: boolean;
};

export type PatchMeasurementsResponse = {
  id: string;
  clientPhotoId: string;
  status: string;
  isLargeWound: boolean;
  lengthCm: number | null;
  widthCm: number | null;
  depthCm: number | null;
  measurementMethod: string | null;
};

export type InitiateAnnotationResponse = {
  id: string;
  clientAnnotationId: string;
  woundPhotoId: string;
  annotationType: string;
  status: string;
  storageKey?: string | null;
  /** Device-facing signed URL — use as returned; do not rewrite host (K25). */
  presignedPutUrl?: string;
  expiresAt?: string;
  _idempotentReplay?: boolean;
};

export type CompleteAnnotationResponse = {
  id: string;
  clientAnnotationId: string;
  status: string;
  annotationType?: string;
};

export type AnnotationMetadata = {
  id: string;
  orgId: string;
  woundPhotoId: string;
  clientAnnotationId: string;
  annotationType: string;
  status: string;
  contentType?: string;
  byteSize?: number | null;
  createdAt?: string;
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
 * GET /v1/episodes/:episodeId/wound-photos — metadata only (no image bytes).
 */
export async function listEpisodeWoundPhotos(
  episodeId: string,
): Promise<WoundPhotoMetadata[]> {
  const res = await apiRequest<{ data: WoundPhotoMetadata[] }>(
    `/v1/episodes/${episodeId}/wound-photos`,
  );
  return res.data ?? [];
}

/**
 * GET /v1/wound-photos/:id — metadata detail.
 */
export async function getWoundPhoto(
  photoId: string,
): Promise<WoundPhotoMetadata> {
  return apiRequest<WoundPhotoMetadata>(`/v1/wound-photos/${photoId}`);
}

/**
 * PATCH /v1/wound-photos/:id/measurements — available photos only (online).
 */
export async function patchWoundPhotoMeasurements(
  photoId: string,
  input: PatchWoundPhotoMeasurementsInput,
): Promise<PatchMeasurementsResponse> {
  return apiRequest<PatchMeasurementsResponse>(
    `/v1/wound-photos/${photoId}/measurements`,
    {
      method: 'PATCH',
      body: input,
    },
  );
}

/**
 * POST /v1/wound-photos/:id/annotations/uploads
 * Child DEK side-car; parent must be available. Online-only (no outbox).
 * Idempotency-Key equals clientAnnotationId.
 */
export async function initiateAnnotationUpload(
  photoId: string,
  input: InitiateAnnotationUploadInput,
): Promise<InitiateAnnotationResponse> {
  return apiRequest<InitiateAnnotationResponse>(
    `/v1/wound-photos/${photoId}/annotations/uploads`,
    {
      method: 'POST',
      body: input,
      headers: {
        'Idempotency-Key': input.clientAnnotationId,
      },
    },
  );
}

/**
 * POST /v1/annotations/:id/wrap-dek — single-use child DEK wrap.
 * Never log dekBase64.
 */
export async function wrapAnnotationDek(
  annotationId: string,
  input: WrapDekInput,
): Promise<WrapDekResponse> {
  return apiRequest<WrapDekResponse>(
    `/v1/annotations/${annotationId}/wrap-dek`,
    {
      method: 'POST',
      body: input,
    },
  );
}

/**
 * POST /v1/annotations/:id/complete
 */
export async function completeAnnotationUpload(
  annotationId: string,
  input: CompleteAnnotationUploadInput,
): Promise<CompleteAnnotationResponse> {
  return apiRequest<CompleteAnnotationResponse>(
    `/v1/annotations/${annotationId}/complete`,
    {
      method: 'POST',
      body: input,
    },
  );
}

/**
 * GET /v1/wound-photos/:id/annotations — metadata only.
 */
export async function listPhotoAnnotations(
  photoId: string,
): Promise<AnnotationMetadata[]> {
  const res = await apiRequest<{ data: AnnotationMetadata[] }>(
    `/v1/wound-photos/${photoId}/annotations`,
  );
  return res.data ?? [];
}

/**
 * GET /v1/wound-photos/:id/content — decrypt proxy (auth header required).
 * Returns JPEG bytes as base64 for Image data URI (online re-view only).
 */
export async function fetchWoundPhotoContentBase64(
  photoId: string,
): Promise<{ base64: string; contentType: string }> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('NOT_AUTHENTICATED');
  }
  const res = await fetch(`${API_URL}/v1/wound-photos/${photoId}/content`, {
    method: 'GET',
    headers: {
      Accept: 'image/jpeg, application/octet-stream, */*',
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const err = new Error(`PHOTO_CONTENT_FAILED:${res.status}`) as Error & {
      status: number;
      code: string;
    };
    err.status = res.status;
    err.code = 'PHOTO_CONTENT_FAILED';
    throw err;
  }
  const contentType =
    res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
  const buf = await res.arrayBuffer();
  // Chunked btoa for large JPEGs
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return { base64: btoa(binary), contentType };
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
