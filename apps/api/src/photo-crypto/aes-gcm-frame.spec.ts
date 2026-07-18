/**
 * Framing unit tests against shared PHOTO_CRYPTO_VECTORS (PR1 / K17 / K18).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PHOTO_CRYPTO_VECTORS } from '@hhos/shared';
import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  frameAesGcm,
  unframeAesGcm,
} from './aes-gcm-frame';

describe('aes-gcm framing (PHOTO_CRYPTO_VECTORS)', () => {
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

    it(`round-trips unframe/frame for "${vector.name}"`, () => {
      const framed = Buffer.from(vector.framedHex, 'hex');
      const parts = unframeAesGcm(framed);
      assert.equal(parts.iv.toString('hex'), vector.ivHex);
      assert.equal(parts.tag.toString('hex'), vector.tagHex);
      assert.equal(parts.ciphertext.toString('hex'), vector.ciphertextHex);
      assert.equal(frameAesGcm(parts).toString('hex'), vector.framedHex);
    });
  }

  it('rejects short framed blobs', () => {
    assert.throws(
      () => unframeAesGcm(Buffer.alloc(10)),
      /AES_GCM_FRAME_TOO_SHORT/,
    );
  });

  it('rejects tampered ciphertext (GCM auth)', () => {
    const vector = PHOTO_CRYPTO_VECTORS[1]!;
    const key = Buffer.from(vector.keyHex, 'hex');
    const framed = Buffer.from(vector.framedHex, 'hex');
    framed[framed.length - 1] ^= 0xff;
    assert.throws(() => aesGcmDecrypt(framed, key));
  });
});
