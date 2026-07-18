/**
 * Simple node selftest for redactForAudit (no jest).
 * Run: compile with tsc then `node dist/common/redact.selftest.js`
 */
import assert from 'node:assert/strict';
import { redactForAudit } from './redact';

function main() {
  const input = {
    id: 'photo-1',
    status: 'available',
    dek: 'should-not-appear',
    dekBase64: 'QUJDREVG',
    wrappedDek: 'wrap-me',
    plaintext: 'raw-bytes',
    cipherBytes: [1, 2, 3],
    geo: { lat: 35.4, lng: -97.5 },
    geoLat: 35.4,
    geoLng: -97.5,
    nested: {
      dek_base64: 'also-secret',
      lat: 1.23,
      lng: 4.56,
      safe: 'ok',
    },
    ssn: '123-45-6789',
    memberId: 'MEM-1',
    note: 'clinical note ok',
  };

  const out = redactForAudit(input) as Record<string, unknown>;

  assert.equal(out.id, 'photo-1');
  assert.equal(out.status, 'available');
  assert.equal(out.note, 'clinical note ok');
  assert.equal(out.dek, '[REDACTED]');
  assert.equal(out.dekBase64, '[REDACTED]');
  assert.equal(out.wrappedDek, '[REDACTED]');
  assert.equal(out.plaintext, '[REDACTED]');
  assert.equal(out.cipherBytes, '[REDACTED]');
  assert.equal(out.geo, '[REDACTED]');
  assert.equal(out.geoLat, '[REDACTED]');
  assert.equal(out.geoLng, '[REDACTED]');
  assert.equal(out.ssn, '[REDACTED]');
  assert.equal(out.memberId, '[REDACTED]');

  const nested = out.nested as Record<string, unknown>;
  assert.equal(nested.dek_base64, '[REDACTED]');
  assert.equal(nested.lat, '[REDACTED]');
  assert.equal(nested.lng, '[REDACTED]');
  assert.equal(nested.safe, 'ok');

  const json = JSON.stringify(out);
  assert.equal(json.includes('should-not-appear'), false);
  assert.equal(json.includes('QUJDREVG'), false);
  assert.equal(json.includes('123-45-6789'), false);
  assert.equal(json.includes('35.4'), false);

  console.log('redact.selftest: ok');
}

main();
