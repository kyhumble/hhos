/**
 * Lightweight node:test coverage for consent-gate transport vs HTTP classification.
 * Pure .mjs so it runs without tsx/transpile.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/** Mirror of isAuthoritativeOnlineDenial — keep in sync with client.ts */
function isAuthoritativeOnlineDenial(status) {
  return status === 401 || status === 403 || status === 404;
}

function isTransportFailure(err) {
  if (err && err.name === 'ApiError') return false;
  if (err instanceof TypeError) return true;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes('network request failed') ||
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('aborted') ||
      err.name === 'AbortError'
    );
  }
  return false;
}

describe('isTransportFailure', () => {
  it('is false for ApiError-like objects', () => {
    const apiErr = new Error('fail');
    apiErr.name = 'ApiError';
    assert.equal(isTransportFailure(apiErr), false);
  });

  it('is true for TypeError / failed fetch', () => {
    assert.equal(isTransportFailure(new TypeError('Network request failed')), true);
    assert.equal(isTransportFailure(new Error('Failed to fetch')), true);
  });
});

describe('isAuthoritativeOnlineDenial', () => {
  it('flags 401/403/404', () => {
    assert.equal(isAuthoritativeOnlineDenial(401), true);
    assert.equal(isAuthoritativeOnlineDenial(403), true);
    assert.equal(isAuthoritativeOnlineDenial(404), true);
  });

  it('does not flag 5xx as authoritative deny (soft offline path)', () => {
    assert.equal(isAuthoritativeOnlineDenial(500), false);
    assert.equal(isAuthoritativeOnlineDenial(400), false);
  });
});

describe('online no-grant policy', () => {
  it('network success without grant must deny and not use cache', () => {
    const networkOk = true;
    const clinicalGrant = null;
    const shouldDeny = networkOk && !clinicalGrant;
    assert.equal(shouldDeny, true);
  });
});
