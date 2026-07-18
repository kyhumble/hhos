/**
 * Safe audit projections for wound_photos — never include DEK material or geo.
 * redactForAudit also covers sensitive keys; this strips known PHI-adjacent fields early.
 */

export type WoundPhotoAuditRow = {
  id: string;
  orgId: string;
  patientId: string;
  episodeId: string;
  woundId: string;
  visitId?: string | null;
  consentRecordId: string;
  clientPhotoId: string;
  status: string;
  capturedAt: Date | string;
  capturedByUserId: string;
  deviceId: string;
  deviceModel?: string | null;
  deviceOs?: string | null;
  appVersion?: string | null;
  contentType?: string | null;
  byteSize?: number | null;
  plaintextSha256?: string | null;
  cipherSha256?: string | null;
  storageKey?: string | null;
  widthPx?: number | null;
  heightPx?: number | null;
  captureSource?: string | null;
  purposeAtCapture?: string | null;
  lengthCm?: unknown;
  widthCm?: unknown;
  depthCm?: unknown;
  measurementMethod?: string | null;
  isLargeWound?: boolean;
  kekKeyId?: string | null;
  uploadedAt?: Date | string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  // intentionally omitted from projection even if present on full row:
  wrappedDek?: unknown;
  geoLat?: unknown;
  geoLng?: unknown;
  geoAccuracyM?: unknown;
};

export function safePhotoAudit(row: WoundPhotoAuditRow | null | undefined) {
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.orgId,
    patientId: row.patientId,
    episodeId: row.episodeId,
    woundId: row.woundId,
    visitId: row.visitId ?? null,
    consentRecordId: row.consentRecordId,
    clientPhotoId: row.clientPhotoId,
    status: row.status,
    capturedAt: row.capturedAt,
    capturedByUserId: row.capturedByUserId,
    deviceId: row.deviceId,
    deviceModel: row.deviceModel ?? null,
    deviceOs: row.deviceOs ?? null,
    appVersion: row.appVersion ?? null,
    contentType: row.contentType ?? null,
    byteSize: row.byteSize ?? null,
    plaintextSha256: row.plaintextSha256 ?? null,
    cipherSha256: row.cipherSha256 ?? null,
    storageKey: row.storageKey ?? null,
    widthPx: row.widthPx ?? null,
    heightPx: row.heightPx ?? null,
    captureSource: row.captureSource ?? null,
    purposeAtCapture: row.purposeAtCapture ?? null,
    lengthCm: row.lengthCm ?? null,
    widthCm: row.widthCm ?? null,
    depthCm: row.depthCm ?? null,
    measurementMethod: row.measurementMethod ?? null,
    isLargeWound: row.isLargeWound ?? false,
    kekKeyId: row.kekKeyId ?? null,
    uploadedAt: row.uploadedAt ?? null,
    hasWrappedDek: Boolean(row.wrappedDek),
  };
}
