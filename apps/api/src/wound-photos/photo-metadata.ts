/**
 * Safe API metadata projections for wound photos (K22).
 * Never expose wrapped DEK material. Geo is role-filtered (clinical / compliance / admin).
 */
import type { AuthUser } from '../common/auth.types';
import type { WoundPhotoRow } from './wound-photos.service';
import { parseNumericCm } from './large-wound';

/** Roles allowed to see geotag on read (design: clinical/compliance/admin; never billing). */
const GEO_VIEW_ROLES = new Set([
  'field_rn',
  'clinical_lead',
  'compliance',
  'admin',
]);

export function canViewPhotoGeo(user: AuthUser): boolean {
  return user.roles.some((r) => GEO_VIEW_ROLES.has(r));
}

/**
 * Roles that may use the normal clinical content path (assert WOUND_PHOTO_CLINICAL).
 * Compliance must use break-glass (K16/K28).
 */
export function canUseClinicalContentPath(user: AuthUser): boolean {
  return user.roles.some(
    (r) => r === 'field_rn' || r === 'clinical_lead' || r === 'admin',
  );
}

export function toPhotoMetadata(
  row: WoundPhotoRow,
  user: AuthUser,
): Record<string, unknown> {
  const includeGeo = canViewPhotoGeo(user);
  const base: Record<string, unknown> = {
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
    contentType: row.contentType ?? 'image/jpeg',
    byteSize: row.byteSize ?? null,
    plaintextSha256: row.plaintextSha256 ?? null,
    cipherSha256: row.cipherSha256 ?? null,
    widthPx: row.widthPx ?? null,
    heightPx: row.heightPx ?? null,
    captureSource: row.captureSource ?? null,
    purposeAtCapture: row.purposeAtCapture ?? null,
    lengthCm: parseNumericCm(row.lengthCm),
    widthCm: parseNumericCm(row.widthCm),
    depthCm: parseNumericCm(row.depthCm),
    measurementMethod: row.measurementMethod ?? null,
    isLargeWound: row.isLargeWound ?? false,
    uploadedAt: row.uploadedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    // Envelope presence only — never raw wrappedDek
    hasWrappedDek: Boolean(row.wrappedDek),
    kekKeyId: row.kekKeyId ?? null,
  };

  if (includeGeo) {
    base.geo =
      row.geoLat != null && row.geoLng != null
        ? {
            lat: row.geoLat,
            lng: row.geoLng,
            accuracyM: row.geoAccuracyM ?? undefined,
          }
        : null;
  }

  return base;
}
