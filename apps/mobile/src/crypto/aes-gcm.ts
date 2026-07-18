/**
 * AES-256-GCM for clinical photo ciphertext.
 * Framing (K17): iv (12) || tag (16) || ciphertext. No AAD in MVP.
 * Must match packages/shared PHOTO_CRYPTO_VECTORS and apps/api photo-crypto/aes-gcm-frame.
 *
 * Uses react-native-quick-crypto (Node crypto–compatible). Expo Go unsupported.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'react-native-quick-crypto';
import { Buffer } from '@craftzdog/react-native-buffer';

export const AES_GCM_ALGO = 'aes-256-gcm' as const;
export const AES_GCM_IV_LEN = 12;
export const AES_GCM_TAG_LEN = 16;
export const AES_256_KEY_LEN = 32;

export type FramedParts = {
  iv: Buffer;
  tag: Buffer;
  ciphertext: Buffer;
};

export type EncryptResult = FramedParts & {
  framed: Buffer;
};

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
 * Encrypt plaintext with AES-256-GCM.
 * Pass a fixed IV only for vector tests; production omits iv (random 12 bytes).
 */
export function aesGcmEncrypt(
  plaintext: Buffer | Uint8Array,
  key: Buffer | Uint8Array,
  iv?: Buffer | Uint8Array,
): EncryptResult {
  const keyBuf = Buffer.from(key);
  if (keyBuf.length !== AES_256_KEY_LEN) {
    throw new Error('AES_GCM_INVALID_KEY_LENGTH');
  }
  const nonce = iv ? Buffer.from(iv) : randomBytes(AES_GCM_IV_LEN);
  if (nonce.length !== AES_GCM_IV_LEN) {
    throw new Error('AES_GCM_INVALID_IV_LENGTH');
  }
  const cipher = createCipheriv(AES_GCM_ALGO, keyBuf, nonce);
  const pt = Buffer.from(plaintext);
  const ciphertext = Buffer.concat([cipher.update(pt), cipher.final()]);
  const tag = cipher.getAuthTag();
  const framed = frameAesGcm({ iv: nonce, tag, ciphertext });
  return { iv: nonce, tag, ciphertext, framed };
}

/** Decrypt framed blob iv||tag||ciphertext. Throws on auth failure. */
export function aesGcmDecrypt(
  framed: Buffer | Uint8Array,
  key: Buffer | Uint8Array,
): Buffer {
  const keyBuf = Buffer.from(key);
  if (keyBuf.length !== AES_256_KEY_LEN) {
    throw new Error('AES_GCM_INVALID_KEY_LENGTH');
  }
  const { iv, tag, ciphertext } = unframeAesGcm(Buffer.from(framed));
  const decipher = createDecipheriv(AES_GCM_ALGO, keyBuf, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/** Generate a fresh 32-byte photo DEK. */
export function generatePhotoDek(): Buffer {
  return randomBytes(AES_256_KEY_LEN);
}

/** SHA-256 hex digest of binary data (plaintext or ciphertext). */
export function sha256Hex(data: Buffer | Uint8Array): string {
  return createHash('sha256').update(Buffer.from(data)).digest('hex');
}

export function bufferToBase64(data: Buffer | Uint8Array): string {
  return Buffer.from(data).toString('base64');
}

export function base64ToBuffer(b64: string): Buffer {
  return Buffer.from(b64, 'base64');
}
