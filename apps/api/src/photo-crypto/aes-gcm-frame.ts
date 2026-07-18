/**
 * AES-256-GCM framing helpers shared by field-crypto style encrypt and PHOTO_KEK wrap.
 * Framing (K17): iv (12) || tag (16) || ciphertext. No AAD in MVP.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const AES_GCM_ALGO = 'aes-256-gcm' as const;
export const AES_GCM_IV_LEN = 12;
export const AES_GCM_TAG_LEN = 16;
export const AES_256_KEY_LEN = 32;

export interface FramedParts {
  iv: Buffer;
  tag: Buffer;
  ciphertext: Buffer;
}

export function frameAesGcm(parts: FramedParts): Buffer {
  return Buffer.concat([parts.iv, parts.tag, parts.ciphertext]);
}

export function unframeAesGcm(framed: Buffer): FramedParts {
  if (framed.length < AES_GCM_IV_LEN + AES_GCM_TAG_LEN) {
    throw new Error('AES_GCM_FRAME_TOO_SHORT');
  }
  const iv = framed.subarray(0, AES_GCM_IV_LEN);
  const tag = framed.subarray(AES_GCM_IV_LEN, AES_GCM_IV_LEN + AES_GCM_TAG_LEN);
  const ciphertext = framed.subarray(AES_GCM_IV_LEN + AES_GCM_TAG_LEN);
  return { iv, tag, ciphertext };
}

/**
 * Encrypt with optional fixed IV (tests / vectors). Production callers omit iv.
 * No AAD.
 */
export function aesGcmEncrypt(
  plaintext: Buffer,
  key: Buffer,
  iv?: Buffer,
): { iv: Buffer; tag: Buffer; ciphertext: Buffer; framed: Buffer } {
  if (key.length !== AES_256_KEY_LEN) {
    throw new Error('AES_GCM_INVALID_KEY_LENGTH');
  }
  const nonce = iv ?? randomBytes(AES_GCM_IV_LEN);
  if (nonce.length !== AES_GCM_IV_LEN) {
    throw new Error('AES_GCM_INVALID_IV_LENGTH');
  }
  const cipher = createCipheriv(AES_GCM_ALGO, key, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const framed = frameAesGcm({ iv: nonce, tag, ciphertext });
  return { iv: nonce, tag, ciphertext, framed };
}

/** Decrypt framed blob iv||tag||ciphertext. Throws on auth failure. */
export function aesGcmDecrypt(framed: Buffer, key: Buffer): Buffer {
  if (key.length !== AES_256_KEY_LEN) {
    throw new Error('AES_GCM_INVALID_KEY_LENGTH');
  }
  const { iv, tag, ciphertext } = unframeAesGcm(framed);
  const decipher = createDecipheriv(AES_GCM_ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
