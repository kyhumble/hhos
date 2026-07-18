/**
 * AES-256-GCM framing test vectors (K17 / K18).
 *
 * Framing matches `apps/api/src/common/field-crypto.ts`:
 *   framed = iv (12 bytes) || tag (16 bytes) || ciphertext
 * No AAD in MVP.
 *
 * Vectors are deterministic fixtures for API unit tests and mobile
 * (react-native-quick-crypto) interoperability — not secrets / not PHI.
 */

export interface PhotoCryptoVector {
  /** Fixture name */
  name: string;
  /** Plaintext as hex (empty string for zero-length) */
  plaintextHex: string;
  /** 32-byte AES-256 key as hex */
  keyHex: string;
  /** 12-byte IV / nonce as hex */
  ivHex: string;
  /** 16-byte GCM auth tag as hex */
  tagHex: string;
  /** Ciphertext body only (no IV, no tag) as hex */
  ciphertextHex: string;
  /** Full framed blob: iv || tag || ciphertext as hex */
  framedHex: string;
}

const KEY_HEX =
  '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
const IV_HEX = '0102030405060708090a0b0c';

/** Empty plaintext — valid AES-GCM (tag still produced). */
export const PHOTO_CRYPTO_VECTOR_EMPTY: PhotoCryptoVector = {
  name: 'empty',
  plaintextHex: '',
  keyHex: KEY_HEX,
  ivHex: IV_HEX,
  tagHex: '50e59f37e941fc58804dba253eb1fced',
  ciphertextHex: '',
  framedHex:
    '0102030405060708090a0b0c50e59f37e941fc58804dba253eb1fced',
};

/** Small UTF-8 plaintext "hhos" (4 bytes). */
export const PHOTO_CRYPTO_VECTOR_SMALL: PhotoCryptoVector = {
  name: 'small',
  plaintextHex: '68686f73',
  keyHex: KEY_HEX,
  ivHex: IV_HEX,
  tagHex: '2667f0ecff320de6c76e08ad4d278f0f',
  ciphertextHex: '121a6ad3',
  framedHex:
    '0102030405060708090a0b0c2667f0ecff320de6c76e08ad4d278f0f121a6ad3',
};

/** All framing vectors exported for test harnesses. */
export const PHOTO_CRYPTO_VECTORS: readonly PhotoCryptoVector[] = [
  PHOTO_CRYPTO_VECTOR_EMPTY,
  PHOTO_CRYPTO_VECTOR_SMALL,
] as const;

/** JSON-serializable fixture payload (load from shared export). */
export const PHOTO_CRYPTO_VECTORS_JSON = {
  framing: 'iv(12) || tag(16) || ciphertext',
  algorithm: 'aes-256-gcm',
  aad: null,
  vectors: PHOTO_CRYPTO_VECTORS,
} as const;
