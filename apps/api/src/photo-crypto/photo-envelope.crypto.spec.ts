/**
 * PHOTO_KEK envelope wrap/unwrap unit tests.
 */
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { PHOTO_CRYPTO_VECTOR_SMALL } from '@hhos/shared';
import { aesGcmDecrypt, aesGcmEncrypt } from './aes-gcm-frame';
import {
  LOCAL_PHOTO_KEK_ID,
  PhotoEnvelopeCrypto,
} from './photo-envelope.crypto';

const TEST_KEK_HEX =
  '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';

describe('PhotoEnvelopeCrypto', () => {
  const prevKek = process.env.PHOTO_KEK;
  const prevKekId = process.env.PHOTO_KEK_ID;

  beforeEach(() => {
    process.env.PHOTO_KEK = TEST_KEK_HEX;
    delete process.env.PHOTO_KEK_ID;
  });

  afterEach(() => {
    if (prevKek === undefined) delete process.env.PHOTO_KEK;
    else process.env.PHOTO_KEK = prevKek;
    if (prevKekId === undefined) delete process.env.PHOTO_KEK_ID;
    else process.env.PHOTO_KEK_ID = prevKekId;
  });

  function makeService(): PhotoEnvelopeCrypto {
    const svc = new PhotoEnvelopeCrypto();
    svc.onModuleInit();
    return svc;
  }

  it('is configured when PHOTO_KEK is set', () => {
    const svc = makeService();
    assert.equal(svc.isConfigured(), true);
    assert.equal(svc.getKekKeyId(), LOCAL_PHOTO_KEK_ID);
  });

  it('wraps and unwraps a 32-byte DEK', () => {
    const svc = makeService();
    const dek = svc.generateDek();
    assert.equal(dek.length, 32);

    const { wrappedDek, kekKeyId } = svc.wrapDek(dek);
    assert.equal(kekKeyId, LOCAL_PHOTO_KEK_ID);
    // iv(12) + tag(16) + ct(32) = 60
    assert.equal(wrappedDek.length, 12 + 16 + 32);

    const unwrapped = svc.unwrapDek(wrappedDek, kekKeyId);
    assert.deepEqual(unwrapped, dek);
  });

  it('wrap produces different ciphertext each call (random IV)', () => {
    const svc = makeService();
    const dek = Buffer.alloc(32, 0xab);
    const a = svc.wrapDek(dek);
    const b = svc.wrapDek(dek);
    assert.notEqual(a.wrappedDek.toString('hex'), b.wrappedDek.toString('hex'));
    assert.deepEqual(svc.unwrapDek(a.wrappedDek), dek);
    assert.deepEqual(svc.unwrapDek(b.wrappedDek), dek);
  });

  it('rejects non-32-byte DEK on wrap', () => {
    const svc = makeService();
    assert.throws(() => svc.wrapDek(Buffer.alloc(16)), /32 bytes/);
  });

  it('rejects unsupported kekKeyId on unwrap', () => {
    const svc = makeService();
    const { wrappedDek } = svc.wrapDek(Buffer.alloc(32, 1));
    assert.throws(
      () => svc.unwrapDek(wrappedDek, 'kms/other'),
      /UNSUPPORTED_KEK_KEY_ID/,
    );
  });

  it('uses PHOTO_KEK_ID when set', () => {
    process.env.PHOTO_KEK_ID = 'local/test-v2';
    const svc = makeService();
    assert.equal(svc.getKekKeyId(), 'local/test-v2');
    const { kekKeyId } = svc.wrapDek(Buffer.alloc(32, 2));
    assert.equal(kekKeyId, 'local/test-v2');
  });

  it('KEK can decrypt DEK-wrapped content matching vector framing style', () => {
    // Prove wrap uses same framing as PHOTO_CRYPTO_VECTORS (iv||tag||ct)
    const kek = Buffer.from(TEST_KEK_HEX, 'hex');
    const dek = Buffer.from(PHOTO_CRYPTO_VECTOR_SMALL.keyHex, 'hex');
    const iv = Buffer.from(PHOTO_CRYPTO_VECTOR_SMALL.ivHex, 'hex');
    const { framed } = aesGcmEncrypt(dek, kek, iv);
    assert.deepEqual(aesGcmDecrypt(framed, kek), dek);

    const svc = makeService();
    assert.deepEqual(svc.unwrapDek(framed, LOCAL_PHOTO_KEK_ID), dek);
  });

  it('fails closed when PHOTO_KEK missing', () => {
    delete process.env.PHOTO_KEK;
    const svc = makeService();
    assert.equal(svc.isConfigured(), false);
    assert.throws(() => svc.wrapDek(Buffer.alloc(32, 0)));
  });
});
