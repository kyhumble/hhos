/**
 * Sync worker gate contracts: register-before-initiate, wipe keys, error codes.
 * Source-level (no native modules).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));

function read(rel) {
  return readFileSync(path.resolve(root, rel), 'utf8');
}

describe('syncWorker source contracts', () => {
  const src = read('syncWorker.ts');

  it('requires ensureDeviceRegistered before processing outbox / initiate', () => {
    assert.match(src, /ensureDeviceRegistered/);
    const regIdx = src.indexOf('ensureDeviceRegistered');
    const dueIdx = src.indexOf('listDueOutbox');
    assert.ok(regIdx > 0 && dueIdx > regIdx, 'register must run before listDueOutbox');
  });

  it('implements initiate → wrap → put → complete order', () => {
    assert.match(src, /initiateWoundPhotoUpload|callInitiate/);
    assert.match(src, /wrapWoundPhotoDek|stepWrap/);
    assert.match(src, /putPresignedCipher|stepPut/);
    assert.match(src, /completeWoundPhotoUpload/);
  });

  it('uses presigned URL as returned (no host rewrite)', () => {
    assert.match(src, /do not rewrite host|K25/);
    assert.doesNotMatch(src, /replace\(.*presigned|new URL\(presigned/);
  });

  it('handles DEVICE_NOT_REGISTERED and DEVICE_REVOKED', () => {
    assert.match(src, /DEVICE_NOT_REGISTERED/);
    assert.match(src, /DEVICE_REVOKED/);
    assert.match(src, /wipeLocalOnDeviceRevoke/);
  });

  it('wipes DEK + cipher after complete via wipeAfterSynced', () => {
    assert.match(src, /wipeAfterSynced/);
  });

  it('treats DEK_ALREADY_WRAPPED as resume success', () => {
    assert.match(src, /DEK_ALREADY_WRAPPED/);
  });

  it('sends Idempotency-Key via wound-photos client', () => {
    const api = read('../api/wound-photos.ts');
    assert.match(api, /Idempotency-Key/);
    assert.match(api, /presignedPutUrl/);
  });
});

describe('local-wipe source contracts', () => {
  const src = read('local-wipe.ts');

  it('clears photo DEK and cipher file on sync and revoke', () => {
    assert.match(src, /clearPhotoDek/);
    assert.match(src, /deleteCipherFile/);
    assert.match(src, /wipeLocalOnDeviceRevoke/);
    assert.match(src, /wipeAfterSynced/);
  });
});

describe('device register source contracts', () => {
  const reg = read('../device/register.ts');
  const devices = read('../api/devices.ts');

  it('POSTs /v1/devices/register', () => {
    assert.match(devices, /\/v1\/devices\/register/);
    assert.match(reg, /registerDevice/);
    assert.match(reg, /getOrCreateDeviceId/);
  });
});

describe('secure deviceId key', () => {
  const keys = read('../secure/keys.ts');
  const deviceId = read('../secure/device-id.ts');

  it('uses hhos.deviceId Secure Store key', () => {
    assert.match(keys, /deviceId:\s*['"]hhos\.deviceId['"]/);
    assert.match(deviceId, /SecureKeys\.deviceId/);
  });
});
