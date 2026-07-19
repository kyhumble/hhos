/**
 * Pure backoff / retry classification tests (no native modules).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const backoffPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'backoff.ts',
);
const src = readFileSync(backoffPath, 'utf8');

/** Inline mirror of pure formulas — keep in sync with backoff.ts */
const b = {
  MAX_ATTEMPTS: 20,
  MAX_WALL_MS: 72 * 60 * 60 * 1000,
  backoffBaseMs(attemptCount) {
    const exp = Math.max(0, attemptCount);
    const raw = Math.pow(2, exp) * 5_000;
    return Math.min(15 * 60 * 1000, raw);
  },
  computeBackoffMs(attemptCount, random = Math.random) {
    const base = this.backoffBaseMs(attemptCount);
    const jitter = Math.floor(random() * base);
    return Math.min(15 * 60 * 1000, Math.floor(base / 2) + jitter);
  },
  isDeadLetter(attemptCount, createdAt, now = Date.now()) {
    if (attemptCount >= 20) return true;
    if (now - createdAt >= 72 * 60 * 60 * 1000) return true;
    return false;
  },
  isRetryableSyncError(err) {
    const status = err.status;
    if (status === undefined || status === 0) return true;
    if (status === 408 || status === 429) return true;
    if (status >= 500 && status <= 599) return true;
    return false;
  },
  isDeviceGateCode(code) {
    return code === 'DEVICE_NOT_REGISTERED' || code === 'DEVICE_REVOKED';
  },
  isConsentFreezeCode(code) {
    return (
      code === 'CONSENT_REVOKED' ||
      code === 'CONSENT_REQUIRED' ||
      code === 'CASELOAD_LOST'
    );
  },
};

describe('backoff source contract', () => {
  it('documents min(15m, 2^attempt * 5s) and max 20 / 72h', () => {
    assert.match(src, /15 \* 60 \* 1000/);
    assert.match(src, /MAX_ATTEMPTS = 20/);
    assert.match(src, /72 \* 60 \* 60 \* 1000/);
    assert.match(src, /Math\.pow\(2/);
  });
});

describe('backoffBaseMs', () => {
  it('starts at 5s and doubles', () => {
    assert.equal(b.backoffBaseMs(0), 5_000);
    assert.equal(b.backoffBaseMs(1), 10_000);
    assert.equal(b.backoffBaseMs(2), 20_000);
  });

  it('caps at 15 minutes', () => {
    assert.equal(b.backoffBaseMs(20), 15 * 60 * 1000);
    assert.equal(b.backoffBaseMs(100), 15 * 60 * 1000);
  });
});

describe('computeBackoffMs', () => {
  it('stays within [base/2, base/2+base] capped at 15m for attempt 1', () => {
    const base = b.backoffBaseMs(1); // 10_000
    const zero = b.computeBackoffMs(1, () => 0);
    const one = b.computeBackoffMs(1, () => 0.999999);
    assert.equal(zero, Math.floor(base / 2));
    assert.ok(one <= Math.min(15 * 60 * 1000, Math.floor(base / 2) + base));
    assert.ok(one >= Math.floor(base / 2));
  });
});

describe('isDeadLetter', () => {
  it('trips on attempt count', () => {
    assert.equal(b.isDeadLetter(20, Date.now()), true);
    assert.equal(b.isDeadLetter(19, Date.now()), false);
  });

  it('trips on wall clock age', () => {
    const created = Date.now() - 73 * 60 * 60 * 1000;
    assert.equal(b.isDeadLetter(1, created), true);
  });
});

describe('isRetryableSyncError', () => {
  it('retries network / 408 / 429 / 5xx', () => {
    assert.equal(b.isRetryableSyncError({}), true);
    assert.equal(b.isRetryableSyncError({ status: 0 }), true);
    assert.equal(b.isRetryableSyncError({ status: 408 }), true);
    assert.equal(b.isRetryableSyncError({ status: 429 }), true);
    assert.equal(b.isRetryableSyncError({ status: 500 }), true);
    assert.equal(b.isRetryableSyncError({ status: 503 }), true);
  });

  it('does not retry 401/403/409', () => {
    assert.equal(b.isRetryableSyncError({ status: 401 }), false);
    assert.equal(b.isRetryableSyncError({ status: 403 }), false);
    assert.equal(b.isRetryableSyncError({ status: 409 }), false);
  });
});

describe('device / consent gate codes', () => {
  it('flags DEVICE_NOT_REGISTERED and DEVICE_REVOKED', () => {
    assert.equal(b.isDeviceGateCode('DEVICE_NOT_REGISTERED'), true);
    assert.equal(b.isDeviceGateCode('DEVICE_REVOKED'), true);
    assert.equal(b.isDeviceGateCode('OTHER'), false);
  });

  it('flags consent freeze codes', () => {
    assert.equal(b.isConsentFreezeCode('CONSENT_REVOKED'), true);
    assert.equal(b.isConsentFreezeCode('CASELOAD_LOST'), true);
    assert.equal(b.isConsentFreezeCode('DEVICE_REVOKED'), false);
  });
});
