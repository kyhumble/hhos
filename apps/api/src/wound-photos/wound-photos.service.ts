/**
 * Wound photo control plane (PR 5b + PR 6).
 * Upload: initiate → wrap-dek → complete → abandon.
 * Read: list/detail metadata, GET .../content decrypt proxy, soft-delete, break-glass (K16/K22/K28).
 * K29: sets is_large_wound + measurements only — never inserts clinical_tasks.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { and, desc, eq, inArray, isNull, ne } from 'drizzle-orm';
import {
  episodes,
  organizations,
  visits,
  woundPhotos,
  wounds,
  type HhosDb,
} from '@hhos/db';
import type {
  CompleteWoundPhotoUploadInput,
  InitiateWoundPhotoUploadInput,
  WrapDekInput,
} from '@hhos/shared';
import { Permission } from '@hhos/shared';
import { DB } from '../common/db.module';
import {
  fieldRnCanAccessEpisode,
  fieldRnCanAccessPatient,
} from '../common/caseload';
import { isUniqueViolation } from '../common/db-errors';
import {
  isPhotoGeotagEnvEnabled,
  isWoundPhotosEnabled,
} from '../common/features';
import { AuditService } from '../audit/audit.service';
import { ConsentsService } from '../consents/consents.service';
import { DevicesService } from '../devices/devices.service';
import { PhotoEnvelopeCrypto } from '../photo-crypto/photo-envelope.crypto';
import { ObjectStorageService } from '../storage/object-storage.service';
import type { AuthUser } from '../common/auth.types';
import { createAesGcmDecryptStream } from './aes-gcm-decrypt-stream';
import {
  releaseDecryptSlot,
  tryAcquireDecryptSlot,
} from './decrypt-limit';
import { computeIsLargeWound, parseNumericCm } from './large-wound';
import { safePhotoAudit } from './photo-audit';
import {
  canUseClinicalContentPath,
  toPhotoMetadata,
} from './photo-metadata';
import { allowWrapDek } from './wrap-rate-limit';

export type WoundPhotoRow = typeof woundPhotos.$inferSelect;

export type RequestMeta = {
  requestId?: string;
  ip?: string;
  userAgent?: string;
};

const DEFAULT_PHOTO_MAX_BYTES = 12_000_000;
const PENDING_STATUSES = new Set(['pending_upload', 'pending_put']);

function toBuffer(chunk: unknown): Buffer {
  if (Buffer.isBuffer(chunk)) return chunk;
  if (typeof chunk === 'string') return Buffer.from(chunk);
  if (chunk instanceof Uint8Array) return Buffer.from(chunk);
  if (chunk instanceof ArrayBuffer) return Buffer.from(new Uint8Array(chunk));
  // Fallback for other ArrayBufferViews
  if (ArrayBuffer.isView(chunk)) {
    return Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  }
  throw new Error('Unexpected stream chunk type');
}

@Injectable()
export class WoundPhotosService {
  private readonly logger = new Logger(WoundPhotosService.name);

  constructor(
    @Inject(DB) private readonly db: HhosDb,
    private readonly audit: AuditService,
    private readonly consents: ConsentsService,
    private readonly devices: DevicesService,
    private readonly storage: ObjectStorageService,
    private readonly photoCrypto: PhotoEnvelopeCrypto,
  ) {}

  /** Master feature gate — 404 when FEATURE_WOUND_PHOTOS is off. */
  assertFeatureEnabled(): void {
    if (!isWoundPhotosEnabled()) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Not found' },
      });
    }
  }

  // ─── Initiate ─────────────────────────────────────────────────────────────

  /**
   * POST /v1/wound-photos/uploads
   * Consent + active device + geotag fail-closed + idempotent on clientPhotoId.
   * Returns existing row + fresh presign when still pending.
   */
  async initiate(
    user: AuthUser,
    input: InitiateWoundPhotoUploadInput,
    meta?: RequestMeta & { idempotencyKey?: string },
  ) {
    this.assertFeatureEnabled();

    if (meta?.idempotencyKey && meta.idempotencyKey !== input.clientPhotoId) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Idempotency-Key must equal clientPhotoId',
        },
      });
    }

    await this.assertEpisodeAccess(user, input.episodeId);
    await this.assertPatientAccess(user, input.patientId);

    await this.consents.assertConsentPurpose(user, {
      patientId: input.patientId,
      consentRecordId: input.consentRecordId,
      purpose: 'WOUND_PHOTO_CLINICAL',
      episodeId: input.episodeId,
    });

    await this.devices.assertActiveDevice(user.orgId, input.device.deviceId);

    const { orgSettings, episode, wound } = await this.loadInitiateContext(
      user.orgId,
      input,
    );

    const maxBytes = orgSettings.photoMaxBytes ?? DEFAULT_PHOTO_MAX_BYTES;
    if (input.byteSize > maxBytes) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_FAILED',
          message: `byteSize exceeds org photoMaxBytes (${maxBytes})`,
        },
      });
    }

    // Idempotent replay: unique (org_id, client_photo_id)
    const existing = await this.findByClientPhotoId(
      user.orgId,
      input.clientPhotoId,
    );
    if (existing) {
      return this.replayOrConflictInitiate(user, existing, input, meta);
    }

    const allowGeo =
      isPhotoGeotagEnvEnabled() && orgSettings.photoGeotagEnabled === true;
    const geo = allowGeo && input.geo ? input.geo : null;

    const capturedAt = new Date(input.capturedAt);
    // Pre-generate id so storage key is stable before insert
    const photoId = randomUUID();
    const storageKey = this.storage.woundPhotoObjectKey(
      user.orgId,
      photoId,
      capturedAt,
    );

    if (!this.storage.isConfigured()) {
      throw new ServiceUnavailableException({
        error: {
          code: 'OBJECT_STORAGE_NOT_CONFIGURED',
          message: 'S3_ENDPOINT is not configured',
        },
      });
    }

    try {
      const row = await this.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(woundPhotos)
          .values({
            id: photoId,
            orgId: user.orgId,
            patientId: input.patientId,
            episodeId: input.episodeId,
            woundId: input.woundId,
            visitId: input.visitId ?? null,
            consentRecordId: input.consentRecordId,
            clientPhotoId: input.clientPhotoId,
            status: 'pending_upload',
            capturedAt,
            capturedByUserId: user.id,
            deviceId: input.device.deviceId,
            deviceModel: input.device.model,
            deviceOs: input.device.os,
            appVersion: input.device.appVersion,
            geoLat: geo?.lat ?? null,
            geoLng: geo?.lng ?? null,
            geoAccuracyM: geo?.accuracyM ?? null,
            contentType: input.contentType,
            byteSize: input.byteSize,
            plaintextSha256: input.plaintextSha256.toLowerCase(),
            storageKey,
            widthPx: input.widthPx ?? null,
            heightPx: input.heightPx ?? null,
            captureSource: 'app_camera',
            purposeAtCapture: 'WOUND_PHOTO_CLINICAL',
            isLargeWound: false,
          })
          .returning();

        if (!created) {
          throw new Error('wound_photos insert returned no row');
        }

        await this.audit.writeFromUser(
          user,
          {
            action: 'wound_photo.initiate',
            resourceType: 'wound_photo',
            resourceId: created.id,
            patientId: created.patientId,
            episodeId: created.episodeId,
            after: safePhotoAudit(created),
            requestId: meta?.requestId,
            ip: meta?.ip,
            userAgent: meta?.userAgent,
            deviceId: created.deviceId,
          },
          tx,
        );

        return created;
      });

      const presign = await this.presignForPhoto(row);
      return this.initiateResponse(row, presign);
    } catch (err) {
      if (isUniqueViolation(err)) {
        const raced = await this.findByClientPhotoId(
          user.orgId,
          input.clientPhotoId,
        );
        if (raced) {
          return this.replayOrConflictInitiate(user, raced, input, meta);
        }
      }
      throw err;
    }
  }

  // ─── Wrap DEK ─────────────────────────────────────────────────────────────

  /**
   * POST /v1/wound-photos/:id/wrap-dek
   * Single-use: second wrap → 409 DEK_ALREADY_WRAPPED.
   * Never log dekBase64.
   */
  async wrapDek(
    user: AuthUser,
    photoId: string,
    input: WrapDekInput,
    meta?: RequestMeta,
  ) {
    this.assertFeatureEnabled();

    if (!allowWrapDek(user.id)) {
      throw new HttpException(
        {
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many wrap-dek requests; try again later',
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!this.photoCrypto.isConfigured()) {
      throw new ServiceUnavailableException({
        error: {
          code: 'PHOTO_KEK_NOT_CONFIGURED',
          message: 'PHOTO_KEK is not configured',
        },
      });
    }

    const photo = await this.loadPhotoOrThrow(user.orgId, photoId);
    await this.assertEpisodeAccess(user, photo.episodeId);
    await this.devices.assertActiveDevice(user.orgId, photo.deviceId);

    if (photo.wrappedDek || photo.status !== 'pending_upload') {
      throw new ConflictException({
        error: {
          code: 'DEK_ALREADY_WRAPPED',
          message: 'DEK has already been wrapped for this photo',
        },
      });
    }

    let dek: Buffer | null = Buffer.from(input.dekBase64, 'base64');
    try {
      if (dek.length !== 32) {
        throw new BadRequestException({
          error: {
            code: 'VALIDATION_FAILED',
            message: 'dekBase64 must decode to exactly 32 bytes',
          },
        });
      }

      const { wrappedDek, kekKeyId } = this.photoCrypto.wrapDek(dek);

      const [updated] = await this.db
        .update(woundPhotos)
        .set({
          wrappedDek,
          kekKeyId,
          status: 'pending_put',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(woundPhotos.id, photo.id),
            eq(woundPhotos.orgId, user.orgId),
            eq(woundPhotos.status, 'pending_upload'),
            isNull(woundPhotos.wrappedDek),
          ),
        )
        .returning();

      if (!updated) {
        // Concurrent wrap or status change — treat as already wrapped
        throw new ConflictException({
          error: {
            code: 'DEK_ALREADY_WRAPPED',
            message: 'DEK has already been wrapped for this photo',
          },
        });
      }

      await this.audit.writeFromUser(user, {
        action: 'wound_photo.dek_wrapped',
        resourceType: 'wound_photo',
        resourceId: updated.id,
        patientId: updated.patientId,
        episodeId: updated.episodeId,
        before: safePhotoAudit(photo),
        after: safePhotoAudit(updated),
        requestId: meta?.requestId,
        ip: meta?.ip,
        userAgent: meta?.userAgent,
        deviceId: updated.deviceId,
      });

      return {
        id: updated.id,
        clientPhotoId: updated.clientPhotoId,
        status: updated.status,
        kekKeyId: updated.kekKeyId,
      };
    } finally {
      // Zeroize DEK buffer after wrap (best-effort)
      if (dek) {
        dek.fill(0);
        dek = null;
      }
    }
  }

  // ─── Complete ─────────────────────────────────────────────────────────────

  /**
   * POST /v1/wound-photos/:id/complete
   * Full ciphertext SHA-256 via internal S3 client.
   * Stores measurements + is_large_wound only (zero clinical_tasks).
   */
  async complete(
    user: AuthUser,
    photoId: string,
    input: CompleteWoundPhotoUploadInput,
    meta?: RequestMeta,
  ) {
    this.assertFeatureEnabled();

    const photo = await this.loadPhotoOrThrow(user.orgId, photoId);
    await this.assertEpisodeAccess(user, photo.episodeId);
    await this.devices.assertActiveDevice(user.orgId, photo.deviceId);

    if (photo.clientPhotoId !== input.clientPhotoId) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'clientPhotoId does not match photo',
        },
      });
    }

    if (photo.status === 'soft_deleted' || photo.status === 'abandoned') {
      throw new GoneException({
        error: {
          code: 'PHOTO_GONE',
          message: `Photo is ${photo.status}`,
        },
      });
    }

    const cipherSha = input.cipherSha256.toLowerCase();

    // Idempotent success if already available with same hash
    if (photo.status === 'available') {
      if (
        photo.cipherSha256?.toLowerCase() === cipherSha &&
        photo.byteSize === input.byteSize
      ) {
        return {
          id: photo.id,
          clientPhotoId: photo.clientPhotoId,
          status: photo.status,
          isLargeWound: photo.isLargeWound,
          uploadedAt: photo.uploadedAt,
        };
      }
      throw new ConflictException({
        error: {
          code: 'INTEGRITY_MISMATCH',
          message: 'Photo already available with different cipher hash/size',
        },
      });
    }

    if (photo.status !== 'pending_put' || !photo.wrappedDek) {
      throw new ConflictException({
        error: {
          code: 'INVALID_PHOTO_STATE',
          message: `Photo status must be pending_put with wrapped DEK (got ${photo.status})`,
        },
      });
    }

    // Re-assert consent still active at complete (design)
    await this.consents.assertConsentPurpose(user, {
      patientId: photo.patientId,
      consentRecordId: photo.consentRecordId,
      purpose: 'WOUND_PHOTO_CLINICAL',
      episodeId: photo.episodeId,
    });

    if (!photo.storageKey) {
      throw new ServiceUnavailableException({
        error: {
          code: 'STORAGE_KEY_MISSING',
          message: 'Photo has no storage key',
        },
      });
    }

    if (!this.storage.isConfigured()) {
      throw new ServiceUnavailableException({
        error: {
          code: 'OBJECT_STORAGE_NOT_CONFIGURED',
          message: 'S3_ENDPOINT is not configured',
        },
      });
    }

    const { digestHex, byteLength } = await this.hashObjectStream(
      photo.storageKey,
    );

    if (digestHex !== cipherSha || byteLength !== input.byteSize) {
      this.logger.warn(
        `integrity mismatch photoId=${photo.id} expectedBytes=${input.byteSize} actualBytes=${byteLength}`,
      );
      throw new ConflictException({
        error: {
          code: 'INTEGRITY_MISMATCH',
          message: 'Ciphertext SHA-256 or byteSize does not match stored object',
        },
      });
    }

    const orgSettings = await this.loadOrgSettings(user.orgId);
    const isLarge = computeIsLargeWound(
      input.lengthCm,
      input.widthCm,
      orgSettings,
    );

    const [updated] = await this.db
      .update(woundPhotos)
      .set({
        status: 'available',
        cipherSha256: cipherSha,
        byteSize: input.byteSize,
        lengthCm:
          input.lengthCm !== undefined ? String(input.lengthCm) : photo.lengthCm,
        widthCm:
          input.widthCm !== undefined ? String(input.widthCm) : photo.widthCm,
        depthCm:
          input.depthCm !== undefined ? String(input.depthCm) : photo.depthCm,
        measurementMethod:
          input.measurementMethod !== undefined
            ? input.measurementMethod
            : photo.measurementMethod,
        isLargeWound: isLarge,
        uploadedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(woundPhotos.id, photo.id),
          eq(woundPhotos.orgId, user.orgId),
          eq(woundPhotos.status, 'pending_put'),
        ),
      )
      .returning();

    if (!updated) {
      // Concurrent complete — re-read for idempotent reply
      const again = await this.loadPhotoOrThrow(user.orgId, photoId);
      if (
        again.status === 'available' &&
        again.cipherSha256?.toLowerCase() === cipherSha
      ) {
        return {
          id: again.id,
          clientPhotoId: again.clientPhotoId,
          status: again.status,
          isLargeWound: again.isLargeWound,
          uploadedAt: again.uploadedAt,
        };
      }
      throw new ConflictException({
        error: {
          code: 'INVALID_PHOTO_STATE',
          message: 'Photo state changed during complete',
        },
      });
    }

    // K29: intentionally no clinical_tasks insert here (PR 7 sole owner)

    await this.audit.writeFromUser(user, {
      action: 'wound_photo.upload_complete',
      resourceType: 'wound_photo',
      resourceId: updated.id,
      patientId: updated.patientId,
      episodeId: updated.episodeId,
      before: safePhotoAudit(photo),
      after: safePhotoAudit(updated),
      requestId: meta?.requestId,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      deviceId: updated.deviceId,
    });

    return {
      id: updated.id,
      clientPhotoId: updated.clientPhotoId,
      status: updated.status,
      isLargeWound: updated.isLargeWound,
      uploadedAt: updated.uploadedAt,
      lengthCm: parseNumericCm(updated.lengthCm),
      widthCm: parseNumericCm(updated.widthCm),
      depthCm: parseNumericCm(updated.depthCm),
      measurementMethod: updated.measurementMethod,
    };
  }

  // ─── Abandon ──────────────────────────────────────────────────────────────

  /**
   * POST /v1/wound-photos/:id/abandon
   * Capturer cancels own pending_* photo. Does not soft-delete available.
   */
  async abandon(user: AuthUser, photoId: string, meta?: RequestMeta) {
    this.assertFeatureEnabled();

    const photo = await this.loadPhotoOrThrow(user.orgId, photoId);
    await this.assertEpisodeAccess(user, photo.episodeId);
    await this.devices.assertActiveDevice(user.orgId, photo.deviceId);

    if (photo.capturedByUserId !== user.id) {
      throw new ForbiddenException({
        error: {
          code: 'FORBIDDEN',
          message: 'Only the capturer may abandon a pending photo',
        },
      });
    }

    if (photo.status === 'abandoned') {
      return {
        id: photo.id,
        clientPhotoId: photo.clientPhotoId,
        status: photo.status,
      };
    }

    if (!PENDING_STATUSES.has(photo.status)) {
      throw new ConflictException({
        error: {
          code: 'INVALID_PHOTO_STATE',
          message: `Cannot abandon photo in status ${photo.status}`,
        },
      });
    }

    // Conditional: only abandon while still pending (fail closed if complete raced)
    const [updated] = await this.db
      .update(woundPhotos)
      .set({
        status: 'abandoned',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(woundPhotos.id, photo.id),
          eq(woundPhotos.orgId, user.orgId),
          eq(woundPhotos.capturedByUserId, user.id),
          inArray(woundPhotos.status, ['pending_upload', 'pending_put']),
        ),
      )
      .returning();

    if (!updated || updated.status !== 'abandoned') {
      throw new ConflictException({
        error: {
          code: 'INVALID_PHOTO_STATE',
          message: 'Photo could not be abandoned (state changed)',
        },
      });
    }

    await this.audit.writeFromUser(user, {
      action: 'wound_photo.abandon',
      resourceType: 'wound_photo',
      resourceId: updated.id,
      patientId: updated.patientId,
      episodeId: updated.episodeId,
      before: safePhotoAudit(photo),
      after: safePhotoAudit(updated),
      requestId: meta?.requestId,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      deviceId: updated.deviceId,
    });

    return {
      id: updated.id,
      clientPhotoId: updated.clientPhotoId,
      status: updated.status,
    };
  }


  // ─── List / detail (metadata only — K22) ──────────────────────────────────

  /**
   * GET /v1/episodes/:episodeId/wound-photos
   * Caseload-scoped metadata list (no image bytes).
   */
  async listForEpisode(user: AuthUser, episodeId: string) {
    this.assertFeatureEnabled();
    await this.assertEpisodeAccess(user, episodeId);

    const rows = await this.db
      .select()
      .from(woundPhotos)
      .where(
        and(
          eq(woundPhotos.orgId, user.orgId),
          eq(woundPhotos.episodeId, episodeId),
          ne(woundPhotos.status, 'soft_deleted'),
          isNull(woundPhotos.deletedAt),
        ),
      )
      .orderBy(desc(woundPhotos.capturedAt))
      .limit(200);

    return { data: rows.map((r) => toPhotoMetadata(r, user)) };
  }

  /**
   * GET /v1/wounds/:woundId/photos
   * Caseload-scoped metadata list for a wound.
   */
  async listForWound(user: AuthUser, woundId: string) {
    this.assertFeatureEnabled();

    const [wound] = await this.db
      .select({
        id: wounds.id,
        episodeId: wounds.episodeId,
      })
      .from(wounds)
      .where(
        and(
          eq(wounds.orgId, user.orgId),
          eq(wounds.id, woundId),
          isNull(wounds.deletedAt),
        ),
      )
      .limit(1);

    if (!wound) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Wound not found' },
      });
    }

    await this.assertEpisodeAccess(user, wound.episodeId);

    const rows = await this.db
      .select()
      .from(woundPhotos)
      .where(
        and(
          eq(woundPhotos.orgId, user.orgId),
          eq(woundPhotos.woundId, woundId),
          ne(woundPhotos.status, 'soft_deleted'),
          isNull(woundPhotos.deletedAt),
        ),
      )
      .orderBy(desc(woundPhotos.capturedAt))
      .limit(200);

    return { data: rows.map((r) => toPhotoMetadata(r, user)) };
  }

  /**
   * GET /v1/wound-photos/:id
   * Metadata detail (geo role-filtered). No ciphertext / DEK.
   */
  async getDetail(user: AuthUser, photoId: string) {
    this.assertFeatureEnabled();

    const photo = await this.loadPhotoOrThrow(user.orgId, photoId);
    await this.assertEpisodeAccess(user, photo.episodeId);

    return toPhotoMetadata(photo, user);
  }

  // ─── Content decrypt proxy (canonical view — K22) ─────────────────────────

  /**
   * GET /v1/wound-photos/:id/content
   * Decrypt-proxy stream only (no view-url). Cache-Control set by controller.
   * Clinical path: assert WOUND_PHOTO_CLINICAL (K28). Compliance: break-glass (K16).
   */
  async getContent(
    user: AuthUser,
    photoId: string,
    opts?: RequestMeta & { breakGlassReason?: string | null },
  ): Promise<{ stream: Readable; contentType: string; release: () => void }> {
    this.assertFeatureEnabled();

    const photo = await this.loadPhotoOrThrow(user.orgId, photoId);
    await this.assertEpisodeAccess(user, photo.episodeId);

    if (photo.status === 'soft_deleted' || photo.status === 'abandoned') {
      throw new GoneException({
        error: {
          code: 'PHOTO_GONE',
          message: `Photo is ${photo.status}`,
        },
      });
    }

    if (photo.status !== 'available') {
      throw new ConflictException({
        error: {
          code: 'INVALID_PHOTO_STATE',
          message: `Photo content not available (status=${photo.status})`,
        },
      });
    }

    if (!photo.wrappedDek || !photo.storageKey) {
      throw new ServiceUnavailableException({
        error: {
          code: 'PHOTO_ENVELOPE_INCOMPLETE',
          message: 'Photo is missing wrapped DEK or storage key',
        },
      });
    }

    if (!this.photoCrypto.isConfigured()) {
      throw new ServiceUnavailableException({
        error: {
          code: 'PHOTO_KEK_NOT_CONFIGURED',
          message: 'PHOTO_KEK is not configured',
        },
      });
    }

    if (!this.storage.isConfigured()) {
      throw new ServiceUnavailableException({
        error: {
          code: 'OBJECT_STORAGE_NOT_CONFIGURED',
          message: 'S3_ENDPOINT is not configured',
        },
      });
    }

    const reason = opts?.breakGlassReason?.trim() || '';
    const breakGlassRequested = reason.length > 0;
    let usedBreakGlass = false;

    if (breakGlassRequested) {
      // K16: BREAK_GLASS_PHI + non-empty reason; skip purpose assert
      if (!user.permissions.includes(Permission.BREAK_GLASS_PHI)) {
        throw new ForbiddenException({
          error: {
            code: 'FORBIDDEN',
            message: 'Break-glass requires break_glass:phi permission',
          },
        });
      }
      usedBreakGlass = true;
    } else if (canUseClinicalContentPath(user)) {
      // K28: field_rn / clinical_lead / admin assert CLINICAL only (not QA)
      await this.consents.assertConsentPurpose(user, {
        patientId: photo.patientId,
        consentRecordId: photo.consentRecordId,
        purpose: 'WOUND_PHOTO_CLINICAL',
        episodeId: photo.episodeId,
      });
    } else {
      // compliance (and any other read role without clinical path)
      throw new ForbiddenException({
        error: {
          code: 'BREAK_GLASS_REQUIRED',
          message:
            'Wound photo content requires clinical purpose path or break-glass with reason',
        },
      });
    }

    if (!tryAcquireDecryptSlot()) {
      throw new ServiceUnavailableException({
        error: {
          code: 'DECRYPT_BUSY',
          message: 'Too many concurrent photo decrypts; retry shortly',
        },
      });
    }

    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        releaseDecryptSlot();
      }
    };

    let dek: Buffer | null = null;
    try {
      dek = this.photoCrypto.unwrapDek(photo.wrappedDek, photo.kekKeyId);
      const cipherStream = await this.storage.getObjectStream(photo.storageKey);
      // Stream copies DEK; safe to zeroize caller buffer immediately after create
      const decryptStream = createAesGcmDecryptStream(dek);
      dek.fill(0);
      dek = null;

      cipherStream.on('error', (err) => {
        this.logger.warn(
          `content cipher stream error photoId=${photo.id} err=${err?.message ?? 'unknown'}`,
        );
        decryptStream.destroy(err);
        release();
      });
      decryptStream.on('error', () => {
        release();
      });
      decryptStream.on('close', () => {
        release();
      });
      decryptStream.on('end', () => {
        release();
      });

      cipherStream.pipe(decryptStream);

      if (usedBreakGlass) {
        // High-severity break-glass audit (actorType break_glass; redacted payloads)
        await this.audit.write({
          orgId: user.orgId,
          actorUserId: user.id,
          actorType: 'break_glass',
          action: 'wound_photo.view_break_glass',
          resourceType: 'wound_photo',
          resourceId: photo.id,
          patientId: photo.patientId,
          episodeId: photo.episodeId,
          reason,
          after: {
            severity: 'high',
            photoId: photo.id,
            status: photo.status,
          },
          requestId: opts?.requestId,
          ip: opts?.ip,
          userAgent: opts?.userAgent,
          deviceId: photo.deviceId,
        });
      } else {
        await this.audit.writeFromUser(user, {
          action: 'wound_photo.view',
          resourceType: 'wound_photo',
          resourceId: photo.id,
          patientId: photo.patientId,
          episodeId: photo.episodeId,
          after: safePhotoAudit(photo),
          requestId: opts?.requestId,
          ip: opts?.ip,
          userAgent: opts?.userAgent,
          deviceId: photo.deviceId,
        });
      }

      this.logger.log(
        `content stream photoId=${photo.id} breakGlass=${usedBreakGlass}`,
      );

      return {
        stream: decryptStream,
        contentType: photo.contentType || 'image/jpeg',
        release,
      };
    } catch (err) {
      if (dek) {
        dek.fill(0);
        dek = null;
      }
      release();
      throw err;
    }
  }

  // ─── Soft-delete ──────────────────────────────────────────────────────────

  /**
   * DELETE /v1/wound-photos/:id
   * Soft-delete available photos only. field_rn lacks wound_photo:delete (guard + service).
   * Leads / compliance / admin: available → soft_deleted.
   */
  async softDelete(user: AuthUser, photoId: string, meta?: RequestMeta) {
    this.assertFeatureEnabled();

    if (!user.permissions.includes(Permission.WOUND_PHOTO_DELETE)) {
      throw new ForbiddenException({
        error: {
          code: 'FORBIDDEN',
          message: 'Requires wound_photo:delete',
        },
      });
    }

    const photo = await this.loadPhotoOrThrow(user.orgId, photoId);
    await this.assertEpisodeAccess(user, photo.episodeId);

    if (photo.status === 'soft_deleted') {
      return {
        id: photo.id,
        clientPhotoId: photo.clientPhotoId,
        status: photo.status,
      };
    }

    if (photo.status !== 'available') {
      throw new ConflictException({
        error: {
          code: 'INVALID_PHOTO_STATE',
          message: `Only available photos can be soft-deleted (got ${photo.status})`,
        },
      });
    }

    const now = new Date();
    const [updated] = await this.db
      .update(woundPhotos)
      .set({
        status: 'soft_deleted',
        deletedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(woundPhotos.id, photo.id),
          eq(woundPhotos.orgId, user.orgId),
          eq(woundPhotos.status, 'available'),
        ),
      )
      .returning();

    if (!updated) {
      throw new ConflictException({
        error: {
          code: 'INVALID_PHOTO_STATE',
          message: 'Photo could not be soft-deleted (state changed)',
        },
      });
    }

    await this.audit.writeFromUser(user, {
      action: 'wound_photo.soft_delete',
      resourceType: 'wound_photo',
      resourceId: updated.id,
      patientId: updated.patientId,
      episodeId: updated.episodeId,
      before: safePhotoAudit(photo),
      after: safePhotoAudit(updated),
      requestId: meta?.requestId,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      deviceId: updated.deviceId,
    });

    return {
      id: updated.id,
      clientPhotoId: updated.clientPhotoId,
      status: updated.status,
    };
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  private async assertEpisodeAccess(user: AuthUser, episodeId: string) {
    const ok = await fieldRnCanAccessEpisode(this.db, user, episodeId);
    if (!ok) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Episode not on your caseload' },
      });
    }
  }

  private async assertPatientAccess(user: AuthUser, patientId: string) {
    const ok = await fieldRnCanAccessPatient(this.db, user, patientId);
    if (!ok) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Patient not on your caseload' },
      });
    }
  }

  private async loadPhotoOrThrow(
    orgId: string,
    photoId: string,
  ): Promise<WoundPhotoRow> {
    const [row] = await this.db
      .select()
      .from(woundPhotos)
      .where(and(eq(woundPhotos.orgId, orgId), eq(woundPhotos.id, photoId)))
      .limit(1);

    if (!row) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Wound photo not found' },
      });
    }
    return row;
  }

  private async findByClientPhotoId(
    orgId: string,
    clientPhotoId: string,
  ): Promise<WoundPhotoRow | null> {
    const [row] = await this.db
      .select()
      .from(woundPhotos)
      .where(
        and(
          eq(woundPhotos.orgId, orgId),
          eq(woundPhotos.clientPhotoId, clientPhotoId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  private async loadOrgSettings(orgId: string) {
    const [org] = await this.db
      .select({ settings: organizations.settings })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    return org?.settings ?? {};
  }

  private async loadInitiateContext(
    orgId: string,
    input: InitiateWoundPhotoUploadInput,
  ) {
    const [org] = await this.db
      .select({ settings: organizations.settings })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!org) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Organization not found' },
      });
    }

    const [episode] = await this.db
      .select({ id: episodes.id, patientId: episodes.patientId })
      .from(episodes)
      .where(
        and(
          eq(episodes.orgId, orgId),
          eq(episodes.id, input.episodeId),
          isNull(episodes.deletedAt),
        ),
      )
      .limit(1);

    if (!episode) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Episode not found' },
      });
    }

    if (episode.patientId !== input.patientId) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'patientId does not match episode patient',
        },
      });
    }

    const [wound] = await this.db
      .select({
        id: wounds.id,
        patientId: wounds.patientId,
        episodeId: wounds.episodeId,
      })
      .from(wounds)
      .where(
        and(
          eq(wounds.orgId, orgId),
          eq(wounds.id, input.woundId),
          isNull(wounds.deletedAt),
        ),
      )
      .limit(1);

    if (!wound) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Wound not found' },
      });
    }

    if (
      wound.patientId !== input.patientId ||
      wound.episodeId !== input.episodeId
    ) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'woundId does not match patient/episode',
        },
      });
    }

    if (input.visitId) {
      const [visit] = await this.db
        .select({
          id: visits.id,
          patientId: visits.patientId,
          episodeId: visits.episodeId,
        })
        .from(visits)
        .where(
          and(
            eq(visits.orgId, orgId),
            eq(visits.id, input.visitId),
            isNull(visits.deletedAt),
          ),
        )
        .limit(1);

      if (!visit) {
        throw new NotFoundException({
          error: { code: 'NOT_FOUND', message: 'Visit not found' },
        });
      }

      if (
        visit.patientId !== input.patientId ||
        visit.episodeId !== input.episodeId
      ) {
        throw new BadRequestException({
          error: {
            code: 'VALIDATION_FAILED',
            message: 'visitId does not match patient/episode',
          },
        });
      }
    }

    return { orgSettings: org.settings ?? {}, episode, wound };
  }

  private async replayOrConflictInitiate(
    user: AuthUser,
    existing: WoundPhotoRow,
    input: InitiateWoundPhotoUploadInput,
    meta?: RequestMeta,
  ) {
    // Same client id with different core bind fields → conflict
    if (
      existing.patientId !== input.patientId ||
      existing.episodeId !== input.episodeId ||
      existing.woundId !== input.woundId ||
      existing.consentRecordId !== input.consentRecordId
    ) {
      throw new ConflictException({
        error: {
          code: 'CONFLICT',
          message:
            'clientPhotoId already used with different patient/episode/wound/consent',
        },
      });
    }

    if (PENDING_STATUSES.has(existing.status)) {
      // Fresh device gate on replay too
      await this.devices.assertActiveDevice(user.orgId, existing.deviceId);
      const presign = await this.presignForPhoto(existing);
      this.logger.log(
        `initiate replay photoId=${existing.id} status=${existing.status}`,
      );
      return this.initiateResponse(existing, presign, true);
    }

    // Already available / abandoned / etc. — return current state without new presign
    return {
      id: existing.id,
      clientPhotoId: existing.clientPhotoId,
      status: existing.status,
      storageKey: existing.storageKey,
      _idempotentReplay: true as const,
    };
  }

  private async presignForPhoto(row: WoundPhotoRow) {
    if (!row.storageKey) {
      throw new ServiceUnavailableException({
        error: {
          code: 'STORAGE_KEY_MISSING',
          message: 'Photo has no storage key',
        },
      });
    }
    // Ciphertext object — octet-stream (plaintext contentType is image/jpeg on the row)
    return this.storage.presignPut(row.storageKey, {
      contentType: 'application/octet-stream',
      contentLength: row.byteSize ?? undefined,
    });
  }

  private initiateResponse(
    row: WoundPhotoRow,
    presign: { url: string; expiresAt: Date; key: string },
    replay = false,
  ) {
    return {
      id: row.id,
      clientPhotoId: row.clientPhotoId,
      status: row.status,
      storageKey: row.storageKey,
      /** Device-facing signed URL — host must not be rewritten (K25). */
      presignedPutUrl: presign.url,
      expiresAt: presign.expiresAt.toISOString(),
      ...(replay ? { _idempotentReplay: true as const } : {}),
    };
  }

  /**
   * Stream full object via internal S3 client and compute SHA-256 + byte length.
   * Required for complete integrity (design: full ciphertext hash, ≤15MB).
   */
  async hashObjectStream(
    storageKey: string,
  ): Promise<{ digestHex: string; byteLength: number }> {
    const stream = await this.storage.getObjectStream(storageKey);
    const hash = createHash('sha256');
    let byteLength = 0;

    for await (const chunk of stream as AsyncIterable<unknown>) {
      const buf = toBuffer(chunk);
      byteLength += buf.length;
      // Hard cap slightly above design max to avoid OOM on misconfigured objects
      if (byteLength > 15_000_000) {
        stream.destroy?.();
        throw new ConflictException({
          error: {
            code: 'INTEGRITY_MISMATCH',
            message: 'Stored object exceeds maximum allowed size',
          },
        });
      }
      hash.update(buf);
    }

    return { digestHex: hash.digest('hex'), byteLength };
  }
}
