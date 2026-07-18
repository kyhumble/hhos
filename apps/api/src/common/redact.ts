const SENSITIVE_KEYS = new Set([
  'ssn',
  'encryptedssn',
  'encrypted_ssn',
  'memberid',
  'member_id',
  'memberidencrypted',
  'member_id_encrypted',
  'databse64',
  'data_base64',
  'signatureblobkey',
  'signature_blob_key',
  'password',
  'token',
  'authorization',
]);

/** Deep-redact sensitive keys for audit before/after payloads. */
export function redactForAudit(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redactForAudit);
  if (typeof value === 'object') {
    if (value instanceof Date) return value.toISOString();
    if (Buffer.isBuffer(value)) return '[REDACTED_BUFFER]';
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const norm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
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
