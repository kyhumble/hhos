/**
 * Streaming AES-256-GCM decrypt for framed blobs: iv(12)||tag(16)||ciphertext.
 * Matches photo-crypto framing (K17). Avoids buffering full plaintext when possible.
 */
import { createDecipheriv, type DecipherGCM } from 'node:crypto';
import { Transform, type TransformCallback } from 'node:stream';
import {
  AES_256_KEY_LEN,
  AES_GCM_ALGO,
  AES_GCM_IV_LEN,
  AES_GCM_TAG_LEN,
} from '../photo-crypto/aes-gcm-frame';

const HEADER_LEN = AES_GCM_IV_LEN + AES_GCM_TAG_LEN;

export function createAesGcmDecryptStream(dek: Buffer): Transform {
  if (dek.length !== AES_256_KEY_LEN) {
    throw new Error('AES_GCM_INVALID_KEY_LENGTH');
  }

  // Copy key so caller may zeroize their buffer immediately after create.
  const key = Buffer.from(dek);
  let headerBuf = Buffer.alloc(0);
  let decipher: DecipherGCM | null = null;

  const zeroizeKey = () => {
    key.fill(0);
  };

  return new Transform({
    transform(chunk: Buffer | string, _enc, cb: TransformCallback) {
      try {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        if (!decipher) {
          headerBuf = Buffer.concat([headerBuf, buf]);
          if (headerBuf.length < HEADER_LEN) {
            cb();
            return;
          }
          const iv = headerBuf.subarray(0, AES_GCM_IV_LEN);
          const tag = headerBuf.subarray(AES_GCM_IV_LEN, HEADER_LEN);
          const rest = headerBuf.subarray(HEADER_LEN);
          decipher = createDecipheriv(AES_GCM_ALGO, key, iv) as DecipherGCM;
          decipher.setAuthTag(tag);
          headerBuf = Buffer.alloc(0);
          if (rest.length > 0) {
            this.push(decipher.update(rest));
          }
          cb();
          return;
        }
        this.push(decipher.update(buf));
        cb();
      } catch (err) {
        zeroizeKey();
        cb(err as Error);
      }
    },
    flush(cb: TransformCallback) {
      try {
        if (!decipher) {
          zeroizeKey();
          cb(new Error('AES_GCM_FRAME_TOO_SHORT'));
          return;
        }
        this.push(decipher.final());
        zeroizeKey();
        cb();
      } catch (err) {
        zeroizeKey();
        cb(err as Error);
      }
    },
  });
}
