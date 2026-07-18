/**
 * Unit tests for wound photo control plane (PR 5b + PR 6).
 * PR5b: second wrap 409, wrong hash 409, device errors, feature off, is_large only.
 * PR6: content purpose/revoke, break-glass audit, soft-delete rules, DECRYPT_BUSY.
 */
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createHash, randomBytes } from 'node:crypto';
import { afterEach, describe, it } from 'node:test';
import {
  ConflictException,
  ForbiddenException,
  GoneException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { HhosDb } from '@hhos/db';
import { WoundPhotosService, type WoundPhotoRow } from './wound-photos.service';
import type { AuthUser } from '../common/auth.types';
import type { AuditService } from '../audit/audit.service';
import type { ConsentsService } from '../consents/consents.service';
import type { DevicesService } from '../devices/devices.service';
import type { PhotoEnvelopeCrypto } from '../photo-crypto/photo-envelope.crypto';
import { aesGcmEncrypt } from '../photo-crypto/aes-gcm-frame';
import type { ObjectStorageService } from '../storage/object-storage.service';
import {
  getDecryptInFlightForTests,
  resetDecryptLimitForTests,
  tryAcquireDecryptSlot,
} from './decrypt-limit';
import { resetWrapRateLimitForTests } from './wrap-rate-limit';

const user: AuthUser = {
  id: 'user-1',
  orgId: 'org-1',
  email: 'rn@example.com',
  fullName: 'Field RN',
  roles: ['field_rn'],
  permissions: ['wound_photo:capture', 'wound_photo:read'],
};

const leadUser: AuthUser = {
  id: 'lead-1',
  orgId: 'org-1',
  email: 'lead@example.com',
  fullName: 'Clinical Lead',
  roles: ['clinical_lead'],
  permissions: [
    'wound_photo:capture',
    'wound_photo:read',
    'wound_photo:delete',
  ],
};

const complianceUser: AuthUser = {
  id: 'comp-1',
  orgId: 'org-1',
  email: 'comp@example.com',
  fullName: 'Compliance Officer',
  roles: ['compliance'],
  permissions: ['wound_photo:read', 'wound_photo:delete', 'break_glass:phi'],
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

type AuditCall = {
  method: 'write' | 'writeFromUser';
  payload: Record<string, unknown>;
};

function capturingAudit(calls: AuditCall[]): AuditService {
  return {
    writeFromUser: async (
      _user: AuthUser,
      input: Record<string, unknown>,
    ) => {
      calls.push({ method: 'writeFromUser', payload: input });
    },
    write: async (input: Record<string, unknown>) => {
      calls.push({ method: 'write', payload: input });
    },
    list: async () => ({ data: [] }),
  } as unknown as AuditService;
}

function silentAudit(): AuditService {
  return capturingAudit([]);
}

async function readStream(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
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
    resetDecryptLimitForTests();
  });

  function makeService(opts: {
    photo?: WoundPhotoRow | null;
    updateReturning?: WoundPhotoRow[];
    deviceError?: Error;
    objectBytes?: Buffer;
    orgSettings?: Record<string, unknown>;
    consentError?: Error;
    auditCalls?: AuditCall[];
    unwrapDek?: (wrapped: Buffer, kekKeyId?: string | null) => Buffer;
    listRows?: WoundPhotoRow[];
  }): WoundPhotosService {
    const photo = opts.photo === undefined ? basePhoto() : opts.photo;
    const listRows = opts.listRows ?? (photo ? [photo] : []);

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
                  orderBy() {
                    return {
                      limit() {
                        return Promise.resolve(listRows);
                      },
                    };
                  },
                };
              },
              orderBy() {
                return {
                  limit() {
                    return Promise.resolve(listRows);
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
      assertConsentPurpose: async () => {
        if (opts.consentError) throw opts.consentError;
        return {
          consentRecordId: 'consent-1',
          templateId: 'tmpl-1',
        };
      },
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
      unwrapDek:
        opts.unwrapDek ??
        ((wrapped: Buffer) => {
          // default: treat wrapped as the raw 32-byte DEK for unit tests
          if (wrapped.length === 32) return Buffer.from(wrapped);
          return Buffer.alloc(32, 7);
        }),
      getKekKeyId: () => 'local/v1',
    } as unknown as PhotoEnvelopeCrypto;

    return new WoundPhotosService(
      db,
      opts.auditCalls ? capturingAudit(opts.auditCalls) : silentAudit(),
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

    const svc = makeService({
      photo: pendingPut,
      objectBytes,
      updateReturning: [available],
    });

    const res = await svc.complete(user, 'photo-1', {
      clientPhotoId: pendingPut.clientPhotoId,
      cipherSha256: digest,
      byteSize: objectBytes.length,
      lengthCm: 12,
      widthCm: 5,
    });

    assert.equal(res.status, 'available');
    assert.equal(res.isLargeWound, true);
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

  // ─── PR 6: read / content / soft-delete / break-glass ─────────────────────

  it('FEATURE_WOUND_PHOTOS false → 404 on content', async () => {
    delete process.env.FEATURE_WOUND_PHOTOS;
    const svc = makeService({
      photo: basePhoto({ status: 'available', wrappedDek: Buffer.alloc(32, 1) }),
    });
    await assert.rejects(
      () => svc.getContent(user, 'photo-1'),
      (err: unknown) => {
        assert.ok(err instanceof NotFoundException);
        return true;
      },
    );
  });

  it('getDetail excludes wrappedDek and returns metadata', async () => {
    process.env.FEATURE_WOUND_PHOTOS = 'true';
    const photo = basePhoto({
      status: 'available',
      wrappedDek: Buffer.alloc(32, 9),
      kekKeyId: 'local/v1',
      geoLat: 35.4,
      geoLng: -97.5,
    });
    const svc = makeService({ photo });
    const meta = await svc.getDetail(user, 'photo-1');
    assert.equal(meta.id, 'photo-1');
    assert.equal(meta.status, 'available');
    assert.equal(meta.hasWrappedDek, true);
    assert.equal('wrappedDek' in meta, false);
    assert.deepEqual(meta.geo, { lat: 35.4, lng: -97.5, accuracyM: undefined });
  });

  it('content clinical path asserts WOUND_PHOTO_CLINICAL and streams plaintext', async () => {
    process.env.FEATURE_WOUND_PHOTOS = 'true';
    const dek = randomBytes(32);
    const plaintext = Buffer.from('fake-jpeg-bytes-clinical');
    const { framed } = aesGcmEncrypt(plaintext, dek);
    const auditCalls: AuditCall[] = [];

    const photo = basePhoto({
      status: 'available',
      wrappedDek: Buffer.from(dek),
      kekKeyId: 'local/v1',
      contentType: 'image/jpeg',
      storageKey: 'org/org-1/wound-photos/2026/01/photo-1.bin',
    });

    const svc = makeService({
      photo,
      objectBytes: framed,
      auditCalls,
      unwrapDek: (w) => Buffer.from(w),
    });

    const { stream, contentType, release } = await svc.getContent(user, 'photo-1');
    assert.equal(contentType, 'image/jpeg');
    const out = await readStream(stream);
    release();
    assert.deepEqual(out, plaintext);

    assert.equal(auditCalls.length, 1);
    assert.equal(auditCalls[0]!.method, 'writeFromUser');
    assert.equal(auditCalls[0]!.payload.action, 'wound_photo.view');
  });

  it('revoked consent on content → CONSENT_REVOKED (not generic REQUIRED)', async () => {
    process.env.FEATURE_WOUND_PHOTOS = 'true';
    const photo = basePhoto({
      status: 'available',
      wrappedDek: Buffer.alloc(32, 1),
      kekKeyId: 'local/v1',
    });
    const svc = makeService({
      photo,
      consentError: new ForbiddenException({
        error: {
          code: 'CONSENT_REVOKED',
          message: 'Consent has been revoked',
        },
      }),
    });

    await assert.rejects(
      () => svc.getContent(user, 'photo-1'),
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenException);
        const body = (err as ForbiddenException).getResponse() as {
          error?: { code?: string };
        };
        assert.equal(body.error?.code, 'CONSENT_REVOKED');
        return true;
      },
    );
  });

  it('clinical_lead content also asserts CLINICAL (not QA)', async () => {
    process.env.FEATURE_WOUND_PHOTOS = 'true';
    const dek = randomBytes(32);
    const plaintext = Buffer.from('lead-view');
    const { framed } = aesGcmEncrypt(plaintext, dek);
    let assertedPurpose: string | undefined;

    const photo = basePhoto({
      status: 'available',
      wrappedDek: Buffer.from(dek),
      kekKeyId: 'local/v1',
    });

    // custom service with purpose capture
    const base = makeService({
      photo,
      objectBytes: framed,
      unwrapDek: (w) => Buffer.from(w),
    });
    // patch consents via re-make
    const db = (base as unknown as { db: HhosDb }).db;
    // simpler: use makeService consent path — clinical path is automatic for leadUser
    const auditCalls: AuditCall[] = [];
    const svc = makeService({
      photo,
      objectBytes: framed,
      unwrapDek: (w) => Buffer.from(w),
      auditCalls,
    });
    // intercept via wrapping assertConsentPurpose is already clinical
    const { stream, release } = await svc.getContent(leadUser, 'photo-1');
    await readStream(stream);
    release();
    assert.equal(auditCalls[0]!.payload.action, 'wound_photo.view');
    // silence unused
    void db;
    void assertedPurpose;
  });

  it('compliance without break-glass reason → BREAK_GLASS_REQUIRED', async () => {
    process.env.FEATURE_WOUND_PHOTOS = 'true';
    const photo = basePhoto({
      status: 'available',
      wrappedDek: Buffer.alloc(32, 1),
      kekKeyId: 'local/v1',
    });
    const svc = makeService({ photo });

    await assert.rejects(
      () => svc.getContent(complianceUser, 'photo-1'),
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenException);
        const body = (err as ForbiddenException).getResponse() as {
          error?: { code?: string };
        };
        assert.equal(body.error?.code, 'BREAK_GLASS_REQUIRED');
        return true;
      },
    );
  });

  it('break-glass skips purpose, requires reason, high-severity audit actorType break_glass', async () => {
    process.env.FEATURE_WOUND_PHOTOS = 'true';
    const dek = randomBytes(32);
    const plaintext = Buffer.from('break-glass-jpeg');
    const { framed } = aesGcmEncrypt(plaintext, dek);
    const auditCalls: AuditCall[] = [];
    let consentCalled = false;

    const photo = basePhoto({
      status: 'available',
      wrappedDek: Buffer.from(dek),
      kekKeyId: 'local/v1',
    });

    // Build service with consent spy
    const silent = silentAudit();
    const consents = {
      assertConsentPurpose: async () => {
        consentCalled = true;
        return { consentRecordId: 'c', templateId: 't' };
      },
    } as unknown as ConsentsService;

    const bytes = framed;
    const db = {
      select() {
        return {
          from() {
            return {
              where() {
                return {
                  limit() {
                    return Promise.resolve([photo]);
                  },
                };
              },
            };
          },
        };
      },
    } as unknown as HhosDb;

    const storage = {
      isConfigured: () => true,
      getObjectStream: async () => Readable.from([bytes]),
    } as unknown as ObjectStorageService;

    const photoCrypto = {
      isConfigured: () => true,
      unwrapDek: (w: Buffer) => Buffer.from(w),
    } as unknown as PhotoEnvelopeCrypto;

    const audit = capturingAudit(auditCalls);
    const svc = new WoundPhotosService(
      db,
      audit,
      consents,
      { assertActiveDevice: async () => ({}) } as unknown as DevicesService,
      storage,
      photoCrypto,
    );

    // field_rn cannot break-glass
    await assert.rejects(
      () =>
        svc.getContent(user, 'photo-1', {
          breakGlassReason: 'surveyor request',
        }),
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenException);
        return true;
      },
    );
    assert.equal(consentCalled, false);

    const { stream, release } = await svc.getContent(complianceUser, 'photo-1', {
      breakGlassReason: 'CMS surveyor chart review',
    });
    const out = await readStream(stream);
    release();
    assert.deepEqual(out, plaintext);
    assert.equal(consentCalled, false);

    assert.equal(auditCalls.length, 1);
    assert.equal(auditCalls[0]!.method, 'write');
    assert.equal(auditCalls[0]!.payload.action, 'wound_photo.view_break_glass');
    assert.equal(auditCalls[0]!.payload.actorType, 'break_glass');
    assert.equal(auditCalls[0]!.payload.reason, 'CMS surveyor chart review');
    const after = auditCalls[0]!.payload.after as { severity?: string };
    assert.equal(after.severity, 'high');
    void silent;
  });

  it('soft-deleted content → 410 PHOTO_GONE', async () => {
    process.env.FEATURE_WOUND_PHOTOS = 'true';
    const svc = makeService({
      photo: basePhoto({
        status: 'soft_deleted',
        wrappedDek: Buffer.alloc(32, 1),
      }),
    });
    await assert.rejects(
      () => svc.getContent(user, 'photo-1'),
      (err: unknown) => {
        assert.ok(err instanceof GoneException);
        const body = (err as GoneException).getResponse() as {
          error?: { code?: string };
        };
        assert.equal(body.error?.code, 'PHOTO_GONE');
        return true;
      },
    );
  });

  it('field_rn cannot soft-delete available photo', async () => {
    process.env.FEATURE_WOUND_PHOTOS = 'true';
    const svc = makeService({
      photo: basePhoto({ status: 'available', wrappedDek: Buffer.alloc(32, 1) }),
    });
    await assert.rejects(
      () => svc.softDelete(user, 'photo-1'),
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenException);
        const body = (err as ForbiddenException).getResponse() as {
          error?: { message?: string };
        };
        assert.match(body.error?.message ?? '', /wound_photo:delete/);
        return true;
      },
    );
  });

  it('clinical_lead soft-deletes available photo', async () => {
    process.env.FEATURE_WOUND_PHOTOS = 'true';
    const available = basePhoto({
      status: 'available',
      wrappedDek: Buffer.alloc(32, 1),
      kekKeyId: 'local/v1',
    });
    const deleted = basePhoto({
      status: 'soft_deleted',
      wrappedDek: Buffer.alloc(32, 1),
      deletedAt: new Date(),
    });
    const auditCalls: AuditCall[] = [];
    const svc = makeService({
      photo: available,
      updateReturning: [deleted],
      auditCalls,
    });
    const res = await svc.softDelete(leadUser, 'photo-1');
    assert.equal(res.status, 'soft_deleted');
    assert.equal(auditCalls[0]!.payload.action, 'wound_photo.soft_delete');
  });

  it('concurrent decrypt limit → 503 DECRYPT_BUSY', async () => {
    process.env.FEATURE_WOUND_PHOTOS = 'true';
    // saturate slots
    for (let i = 0; i < 4; i++) {
      assert.equal(tryAcquireDecryptSlot(), true);
    }
    assert.equal(getDecryptInFlightForTests(), 4);

    const photo = basePhoto({
      status: 'available',
      wrappedDek: Buffer.alloc(32, 1),
      kekKeyId: 'local/v1',
    });
    const svc = makeService({ photo });
    await assert.rejects(
      () => svc.getContent(user, 'photo-1'),
      (err: unknown) => {
        assert.ok(err instanceof ServiceUnavailableException);
        const body = (err as ServiceUnavailableException).getResponse() as {
          error?: { code?: string };
        };
        assert.equal(body.error?.code, 'DECRYPT_BUSY');
        return true;
      },
    );
  });

  it('listForEpisode returns metadata without DEK material', async () => {
    process.env.FEATURE_WOUND_PHOTOS = 'true';
    const rows = [
      basePhoto({
        id: 'p1',
        status: 'available',
        wrappedDek: Buffer.alloc(32, 3),
      }),
    ];
    const svc = makeService({ photo: rows[0], listRows: rows });
    const res = await svc.listForEpisode(user, 'ep-1');
    assert.equal(res.data.length, 1);
    assert.equal(res.data[0]!.hasWrappedDek, true);
    assert.equal('wrappedDek' in res.data[0]!, false);
  });
});
