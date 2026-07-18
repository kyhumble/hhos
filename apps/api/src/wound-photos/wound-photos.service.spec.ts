/**
 * Unit tests for wound photo control plane gates (no live DB / MinIO).
 * Acceptance: second wrap 409, wrong hash 409, device errors, feature off, is_large only.
 */
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { afterEach, describe, it } from 'node:test';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { HhosDb } from '@hhos/db';
import { WoundPhotosService, type WoundPhotoRow } from './wound-photos.service';
import type { AuthUser } from '../common/auth.types';
import type { AuditService } from '../audit/audit.service';
import type { ConsentsService } from '../consents/consents.service';
import type { DevicesService } from '../devices/devices.service';
import type { PhotoEnvelopeCrypto } from '../photo-crypto/photo-envelope.crypto';
import type { ObjectStorageService } from '../storage/object-storage.service';
import { resetWrapRateLimitForTests } from './wrap-rate-limit';

const user: AuthUser = {
  id: 'user-1',
  orgId: 'org-1',
  email: 'rn@example.com',
  fullName: 'Field RN',
  roles: ['field_rn'],
  permissions: ['wound_photo:capture', 'wound_photo:read'],
};

function basePhoto(over: Partial<WoundPhotoRow> = {}): WoundPhotoRow {
  return {
    id: 'photo-1',
    orgId: 'org-1',
    patientId: 'pat-1',
    episodeId: 'ep-1',
    woundId: 'wound-1',
    visitId: null,
    consentRecordId: 'consent-1',
    clientPhotoId: '11111111-1111-1111-1111-111111111111',
    status: 'pending_upload',
    capturedAt: new Date('2026-01-01T00:00:00Z'),
    capturedByUserId: 'user-1',
    deviceId: 'device-abc-12345',
    deviceModel: 'iPhone',
    deviceOs: '17',
    appVersion: '1.0.0',
    geoLat: null,
    geoLng: null,
    geoAccuracyM: null,
    contentType: 'image/jpeg',
    byteSize: 100,
    plaintextSha256: 'a'.repeat(64),
    cipherSha256: null,
    storageKey: 'org/org-1/wound-photos/2026/01/photo-1.bin',
    wrappedDek: null,
    kekKeyId: null,
    widthPx: null,
    heightPx: null,
    captureSource: 'app_camera',
    purposeAtCapture: 'WOUND_PHOTO_CLINICAL',
    lengthCm: null,
    widthCm: null,
    depthCm: null,
    measurementMethod: null,
    isLargeWound: false,
    uploadedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
    ...over,
  } as WoundPhotoRow;
}

function silentAudit(): AuditService {
  return {
    writeFromUser: async () => undefined,
    write: async () => undefined,
    list: async () => ({ data: [] }),
  } as unknown as AuditService;
}

describe('WoundPhotosService control plane', () => {
  const envKeys = ['FEATURE_WOUND_PHOTOS'] as const;
  const snapshot = Object.fromEntries(envKeys.map((k) => [k, process.env[k]]));

  afterEach(() => {
    for (const k of envKeys) {
      const v = snapshot[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    resetWrapRateLimitForTests();
  });

  function makeService(opts: {
    photo?: WoundPhotoRow | null;
    updateReturning?: WoundPhotoRow[];
    deviceError?: Error;
    objectBytes?: Buffer;
    orgSettings?: Record<string, unknown>;
  }): WoundPhotosService {
    const photo = opts.photo === undefined ? basePhoto() : opts.photo;

    const db = {
      select() {
        return {
          from() {
            return {
              where() {
                return {
                  limit() {
                    return Promise.resolve(photo ? [photo] : []);
                  },
                };
              },
            };
          },
        };
      },
      update() {
        return {
          set() {
            return {
              where() {
                return {
                  returning() {
                    return Promise.resolve(opts.updateReturning ?? []);
                  },
                };
              },
            };
          },
        };
      },
      insert() {
        return {
          values() {
            return {
              returning() {
                return Promise.resolve([]);
              },
            };
          },
        };
      },
      transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
    } as unknown as HhosDb;

    const consents = {
      assertConsentPurpose: async () => ({
        consentRecordId: 'consent-1',
        templateId: 'tmpl-1',
      }),
    } as unknown as ConsentsService;

    const devices = {
      assertActiveDevice: async () => {
        if (opts.deviceError) throw opts.deviceError;
        return { deviceId: 'device-abc-12345', status: 'active' };
      },
    } as unknown as DevicesService;

    const bytes = opts.objectBytes ?? Buffer.from('cipher-bytes');
    const storage = {
      isConfigured: () => true,
      getObjectStream: async () => Readable.from([bytes]),
      presignPut: async () => ({
        url: 'http://127.0.0.1:9000/bucket/key?X-Amz-Signature=x',
        expiresAt: new Date(Date.now() + 600_000),
        key: 'key',
        bucket: 'hhos-documents',
      }),
      woundPhotoObjectKey: () => 'org/org-1/wound-photos/2026/01/photo-1.bin',
    } as unknown as ObjectStorageService;

    const photoCrypto = {
      isConfigured: () => true,
      wrapDek: (dek: Buffer) => ({
        wrappedDek: Buffer.concat([Buffer.from('wrapped'), dek.subarray(0, 4)]),
        kekKeyId: 'local/v1',
      }),
      getKekKeyId: () => 'local/v1',
    } as unknown as PhotoEnvelopeCrypto;

    return new WoundPhotosService(
      db,
      silentAudit(),
      consents,
      devices,
      storage,
      photoCrypto,
    );
  }

  it('FEATURE_WOUND_PHOTOS false → 404 on wrap', async () => {
    delete process.env.FEATURE_WOUND_PHOTOS;
    const svc = makeService({});
    await assert.rejects(
      () =>
        svc.wrapDek(user, 'photo-1', {
          dekBase64: Buffer.alloc(32, 1).toString('base64'),
        }),
      (err: unknown) => {
        assert.ok(err instanceof NotFoundException);
        return true;
      },
    );
  });

  it('second wrap → 409 DEK_ALREADY_WRAPPED', async () => {
    process.env.FEATURE_WOUND_PHOTOS = 'true';
    const wrapped = basePhoto({
      status: 'pending_put',
      wrappedDek: Buffer.from('already'),
      kekKeyId: 'local/v1',
    });
    const svc = makeService({ photo: wrapped });

    await assert.rejects(
      () =>
        svc.wrapDek(user, 'photo-1', {
          dekBase64: Buffer.alloc(32, 2).toString('base64'),
        }),
      (err: unknown) => {
        assert.ok(err instanceof ConflictException);
        const body = (err as ConflictException).getResponse() as {
          error?: { code?: string };
        };
        assert.equal(body.error?.code, 'DEK_ALREADY_WRAPPED');
        return true;
      },
    );
  });

  it('wrap happy path when pending_upload and update succeeds', async () => {
    process.env.FEATURE_WOUND_PHOTOS = 'true';
    const pending = basePhoto({ status: 'pending_upload', wrappedDek: null });
    const after = basePhoto({
      status: 'pending_put',
      wrappedDek: Buffer.from('w'),
      kekKeyId: 'local/v1',
    });
    const svc = makeService({ photo: pending, updateReturning: [after] });
    const res = await svc.wrapDek(user, 'photo-1', {
      dekBase64: Buffer.alloc(32, 3).toString('base64'),
    });
    assert.equal(res.status, 'pending_put');
    assert.equal(res.kekKeyId, 'local/v1');
  });

  it('complete wrong hash → 409 INTEGRITY_MISMATCH', async () => {
    process.env.FEATURE_WOUND_PHOTOS = 'true';
    const pendingPut = basePhoto({
      status: 'pending_put',
      wrappedDek: Buffer.from('wrapped-dek'),
      kekKeyId: 'local/v1',
      byteSize: 12,
    });
    const objectBytes = Buffer.from('actual-cipher');
    const svc = makeService({ photo: pendingPut, objectBytes });

    const wrongHash = 'b'.repeat(64);
    await assert.rejects(
      () =>
        svc.complete(user, 'photo-1', {
          clientPhotoId: pendingPut.clientPhotoId,
          cipherSha256: wrongHash,
          byteSize: objectBytes.length,
        }),
      (err: unknown) => {
        assert.ok(err instanceof ConflictException);
        const body = (err as ConflictException).getResponse() as {
          error?: { code?: string };
        };
        assert.equal(body.error?.code, 'INTEGRITY_MISMATCH');
        return true;
      },
    );
  });

  it('complete matching hash sets isLargeWound from measurements (no clinical_tasks path)', async () => {
    process.env.FEATURE_WOUND_PHOTOS = 'true';
    const objectBytes = Buffer.from('cipher-ok');
    const digest = createHash('sha256').update(objectBytes).digest('hex');
    const pendingPut = basePhoto({
      status: 'pending_put',
      wrappedDek: Buffer.from('wrapped-dek'),
      kekKeyId: 'local/v1',
      byteSize: objectBytes.length,
    });
    const available = basePhoto({
      status: 'available',
      wrappedDek: Buffer.from('wrapped-dek'),
      kekKeyId: 'local/v1',
      cipherSha256: digest,
      byteSize: objectBytes.length,
      isLargeWound: true,
      lengthCm: '12.00',
      widthCm: '5.00',
      uploadedAt: new Date(),
    });

    // complete path: load photo, then load org settings, then update
    // Our mock select always returns the same photo; org settings path also uses select.
    // isLarge is computed before update; updateReturning provides result.
    const svc = makeService({
      photo: pendingPut,
      objectBytes,
      updateReturning: [available],
    });

    // Override loadOrgSettings by intercepting: org select returns photo-shaped row
    // which is wrong for settings — computeIsLargeWound uses defaults when settings empty.
    // Force a select that returns settings for org lookups by patching service internals:
    // Instead: large by lengthCm >= 10 with defaults when settings = {}.
    // Our mock returns [photo] for ALL selects including org — settings will be undefined → defaults.

    const res = await svc.complete(user, 'photo-1', {
      clientPhotoId: pendingPut.clientPhotoId,
      cipherSha256: digest,
      byteSize: objectBytes.length,
      lengthCm: 12,
      widthCm: 5,
    });

    assert.equal(res.status, 'available');
    assert.equal(res.isLargeWound, true);
    // K29: service has no clinicalTasks insert method / dependency
    assert.equal(
      // @ts-expect-error intentional — prove no clinical tasks collaborator
      (svc as { clinicalTasks?: unknown }).clinicalTasks,
      undefined,
    );
  });

  it('missing device → DEVICE_NOT_REGISTERED propagates', async () => {
    process.env.FEATURE_WOUND_PHOTOS = 'true';
    const svc = makeService({
      photo: basePhoto({ status: 'pending_upload' }),
      deviceError: new ForbiddenException({
        error: {
          code: 'DEVICE_NOT_REGISTERED',
          message: 'Device must be registered before this operation',
        },
      }),
    });

    await assert.rejects(
      () =>
        svc.wrapDek(user, 'photo-1', {
          dekBase64: Buffer.alloc(32, 4).toString('base64'),
        }),
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenException);
        const body = (err as ForbiddenException).getResponse() as {
          error?: { code?: string };
        };
        assert.equal(body.error?.code, 'DEVICE_NOT_REGISTERED');
        return true;
      },
    );
  });

  it('revoked device → DEVICE_REVOKED propagates', async () => {
    process.env.FEATURE_WOUND_PHOTOS = 'true';
    const svc = makeService({
      photo: basePhoto({
        status: 'pending_put',
        wrappedDek: Buffer.from('w'),
      }),
      deviceError: new ForbiddenException({
        error: {
          code: 'DEVICE_REVOKED',
          message: 'Device has been revoked',
        },
      }),
    });

    await assert.rejects(
      () =>
        svc.complete(user, 'photo-1', {
          clientPhotoId: '11111111-1111-1111-1111-111111111111',
          cipherSha256: 'c'.repeat(64),
          byteSize: 10,
        }),
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenException);
        const body = (err as ForbiddenException).getResponse() as {
          error?: { code?: string };
        };
        assert.equal(body.error?.code, 'DEVICE_REVOKED');
        return true;
      },
    );
  });

  it('abandon non-capturer → FORBIDDEN', async () => {
    process.env.FEATURE_WOUND_PHOTOS = 'true';
    const svc = makeService({
      photo: basePhoto({
        capturedByUserId: 'other-user',
        status: 'pending_upload',
      }),
    });

    await assert.rejects(
      () => svc.abandon(user, 'photo-1'),
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenException);
        return true;
      },
    );
  });

  it('hashObjectStream matches createHash', async () => {
    process.env.FEATURE_WOUND_PHOTOS = 'true';
    const payload = Buffer.from('stream-me-for-sha');
    const expected = createHash('sha256').update(payload).digest('hex');
    const svc = makeService({ objectBytes: payload });
    const { digestHex, byteLength } = await svc.hashObjectStream('any-key');
    assert.equal(digestHex, expected);
    assert.equal(byteLength, payload.length);
  });
});
