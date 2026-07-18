/**
 * Mobile AES-GCM framing vs shared PHOTO_CRYPTO_VECTORS.
 *
 * Mirrors apps/mobile/src/crypto/aes-gcm.ts (react-native-quick-crypto API)
 * using node:crypto so tests run without a native binary. Ciphertext must
 * match server (apps/api photo-crypto/aes-gcm-frame) for the same fixtures.
 */
import assert from 'node:assert/strict';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
} from 'node:crypto';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const sharedRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../packages/shared',
);

let PHOTO_CRYPTO_VECTORS;
try {
  ({ PHOTO_CRYPTO_VECTORS } = require('@hhos/shared'));
} catch {
  // Workspace dist may live at packages/shared/dist
  ({ PHOTO_CRYPTO_VECTORS } = require(
    path.join(sharedRoot, 'dist/photo-crypto-vectors.js'),
  ));
}

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

function frameAesGcm({ iv, tag, ciphertext }) {
  return Buffer.concat([iv, tag, ciphertext]);
}

function unframeAesGcm(framed) {
  if (framed.length < IV_LEN + TAG_LEN) {
    throw new Error('AES_GCM_FRAME_TOO_SHORT');
  }
  return {
    iv: framed.subarray(0, IV_LEN),
    tag: framed.subarray(IV_LEN, IV_LEN + TAG_LEN),
    ciphertext: framed.subarray(IV_LEN + TAG_LEN),
  };
}

/** Same algorithm as mobile src/crypto/aes-gcm.ts */
function aesGcmEncrypt(plaintext, key, iv) {
  if (key.length !== KEY_LEN) throw new Error('AES_GCM_INVALID_KEY_LENGTH');
  if (iv.length !== IV_LEN) throw new Error('AES_GCM_INVALID_IV_LENGTH');
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const framed = frameAesGcm({ iv, tag, ciphertext });
  return { iv, tag, ciphertext, framed };
}

function aesGcmDecrypt(framed, key) {
  if (key.length !== KEY_LEN) throw new Error('AES_GCM_INVALID_KEY_LENGTH');
  const { iv, tag, ciphertext } = unframeAesGcm(framed);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex');
}

describe('mobile aes-gcm framing (PHOTO_CRYPTO_VECTORS)', () => {
  assert.ok(
    Array.isArray(PHOTO_CRYPTO_VECTORS) && PHOTO_CRYPTO_VECTORS.length >= 2,
    'PHOTO_CRYPTO_VECTORS must be loaded from @hhos/shared',
  );

  for (const vector of PHOTO_CRYPTO_VECTORS) {
    it(`encrypts vector "${vector.name}" to expected framed hex`, () => {
      const key = Buffer.from(vector.keyHex, 'hex');
      const iv = Buffer.from(vector.ivHex, 'hex');
      const plaintext = Buffer.from(vector.plaintextHex, 'hex');

      const result = aesGcmEncrypt(plaintext, key, iv);

      assert.equal(result.tag.toString('hex'), vector.tagHex);
      assert.equal(result.ciphertext.toString('hex'), vector.ciphertextHex);
      assert.equal(result.framed.toString('hex'), vector.framedHex);
    });

    it(`decrypts vector "${vector.name}" framed blob to plaintext`, () => {
      const key = Buffer.from(vector.keyHex, 'hex');
      const framed = Buffer.from(vector.framedHex, 'hex');
      const plaintext = aesGcmDecrypt(framed, key);
      assert.equal(plaintext.toString('hex'), vector.plaintextHex);
    });
  }

  it('rejects short framed blobs', () => {
    assert.throws(
      () => unframeAesGcm(Buffer.alloc(10)),
      /AES_GCM_FRAME_TOO_SHORT/,
    );
  });

  it('rejects tampered ciphertext (GCM auth)', () => {
    const vector = PHOTO_CRYPTO_VECTORS[1];
    const key = Buffer.from(vector.keyHex, 'hex');
    const framed = Buffer.from(vector.framedHex, 'hex');
    framed[framed.length - 1] ^= 0xff;
    assert.throws(() => aesGcmDecrypt(framed, key));
  });
});

describe('Secure Store DEK key layout (concurrent photos)', () => {
  /** Mirrors apps/mobile/src/secure/keys.ts SecureKeys.photoDek */
  function photoDekKey(clientPhotoId) {
    return `hhos.photo-dek.${clientPhotoId}`;
  }

  it('uses distinct keys per clientPhotoId', () => {
    const a = '11111111-1111-1111-1111-111111111111';
    const b = '22222222-2222-2222-2222-222222222222';
    assert.equal(photoDekKey(a), 'hhos.photo-dek.11111111-1111-1111-1111-111111111111');
    assert.equal(photoDekKey(b), 'hhos.photo-dek.22222222-2222-2222-2222-222222222222');
    assert.notEqual(photoDekKey(a), photoDekKey(b));
  });

  it('does not use a single shared DEK key', () => {
    const a = photoDekKey('aaa');
    const b = photoDekKey('bbb');
    assert.notEqual(a, 'hhos.photo-dek');
    assert.notEqual(a, b);
  });
});

describe('sha256 helper contract', () => {
  it('hashes empty buffer deterministically', () => {
    assert.equal(
      sha256Hex(Buffer.alloc(0)),
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });
});
