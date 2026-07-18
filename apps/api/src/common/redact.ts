/**
 * Normalized sensitive key names (lowercase, alphanumeric only).
 * Matching uses `normalizeRedactKey` so `dekBase64`, `dek_base64`, `dek-base64` all hit.
 */
const SENSITIVE_KEYS = new Set([
  'ssn',
  'encryptedssn',
  'memberid',
  'memberidencrypted',
  'databse64',
  'signatureblobkey',
  'password',
  'token',
  'authorization',
  // Phase 2 wound-photo / crypto / geo (never persist in audit JSON)
  'dek',
  'dekbase64',
  'wrappeddek',
  'plaintext',
  'cipherbytes',
  'geolat',
  'geolng',
  'geo',
  'lat',
  'lng',
]);

/** Normalize object keys for sensitive-key matching (case/underscore/hyphen insensitive). */
export function normalizeRedactKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Deep-redact sensitive keys for audit before/after payloads. */
export function redactForAudit(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redactForAudit);
  if (typeof value === 'object') {
    if (value instanceof Date) return value.toISOString();
    if (Buffer.isBuffer(value)) return '[REDACTED_BUFFER]';
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const norm = normalizeRedactKey(k);
      if (SENSITIVE_KEYS.has(norm) || norm.includes('encrypted') || norm.includes('ssn')) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redactForAudit(v);
      }
    }
    return out;
  }
  return value;
}
