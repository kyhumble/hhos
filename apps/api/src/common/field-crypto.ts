/**
 * Field-level AES-256-GCM encryption for SSN / insurance member ids.
 * Key: FIELD_ENCRYPTION_KEY as 32-byte hex (64 chars) or base64 (44 chars).
 * When key is missing, encrypt returns null and callers store last4 only.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function resolveKey(): Buffer | null {
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw || raw.length === 0) return null;

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  try {
    const b = Buffer.from(raw, 'base64');
    if (b.length === 32) return b;
  } catch {
    // fall through
  }
  // Derive a stable 32-byte key from arbitrary string (dev convenience only)
  return createHash('sha256').update(raw, 'utf8').digest();
}

/** Encrypt plaintext → Buffer (iv || tag || ciphertext). Null if no key. */
export function fieldEncrypt(plaintext: string): Buffer | null {
  const key = resolveKey();
  if (!key) return null;

  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]);
}

/** Decrypt field blob. Returns null if key missing or ciphertext invalid. */
export function fieldDecrypt(blob: Buffer | null | undefined): string | null {
  if (!blob || blob.length < IV_LEN + TAG_LEN + 1) return null;
  const key = resolveKey();
  if (!key) return null;

  try {
    const iv = blob.subarray(0, IV_LEN);
    const tag = blob.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const data = blob.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export function last4Digits(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

export function isFieldEncryptionConfigured(): boolean {
  return resolveKey() !== null;
}
