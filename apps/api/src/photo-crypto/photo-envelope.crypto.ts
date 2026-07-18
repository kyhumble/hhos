/**
 * PHOTO_KEK envelope: wrap/unwrap per-object DEKs (K3, K4, K19).
 * Framing matches field-crypto / shared PHOTO_CRYPTO_VECTORS (iv||tag||ciphertext).
 * Separate key material from FIELD_ENCRYPTION_KEY.
 */
import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import {
  AES_256_KEY_LEN,
  aesGcmDecrypt,
  aesGcmEncrypt,
} from './aes-gcm-frame';

/** Local single-deployment KEK id until KMS multi-key rotation lands. */
export const LOCAL_PHOTO_KEK_ID = 'local/v1';

function resolvePhotoKek(): Buffer | null {
  const raw = process.env.PHOTO_KEK;
  if (!raw || raw.length === 0) return null;

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  try {
    const b = Buffer.from(raw, 'base64');
    if (b.length === AES_256_KEY_LEN) return b;
  } catch {
    // fall through
  }
  // Dev convenience only — never use arbitrary strings in prod
  return createHash('sha256').update(raw, 'utf8').digest();
}

export interface WrapDekResult {
  /** AES-GCM framed blob: iv || tag || ciphertext(DEK) */
  wrappedDek: Buffer;
  /** e.g. local/v1 — stored on wound_photos.kek_key_id */
  kekKeyId: string;
}

@Injectable()
export class PhotoEnvelopeCrypto implements OnModuleInit {
  private readonly logger = new Logger(PhotoEnvelopeCrypto.name);
  private kek: Buffer | null = null;
  private kekKeyId: string = LOCAL_PHOTO_KEK_ID;

  onModuleInit(): void {
    this.kek = resolvePhotoKek();
    const configuredId = process.env.PHOTO_KEK_ID?.trim();
    if (configuredId) this.kekKeyId = configuredId;

    if (!this.kek) {
      this.logger.warn(
        'PHOTO_KEK not configured — wrap/unwrap will fail until set',
      );
    } else {
      this.logger.log(`Photo envelope crypto ready (kekKeyId=${this.kekKeyId})`);
    }
  }

  isConfigured(): boolean {
    return this.kek !== null;
  }

  getKekKeyId(): string {
    return this.kekKeyId;
  }

  private requireKek(): Buffer {
    if (!this.kek) {
      throw new ServiceUnavailableException({
        code: 'PHOTO_KEK_NOT_CONFIGURED',
        message: 'PHOTO_KEK is not configured',
      });
    }
    return this.kek;
  }

  /**
   * Wrap a 32-byte DEK with PHOTO_KEK. Random IV each call.
   * Caller must zeroize `dek` after use when possible.
   */
  wrapDek(dek: Buffer): WrapDekResult {
    if (dek.length !== AES_256_KEY_LEN) {
      throw new Error('DEK must be exactly 32 bytes');
    }
    const kek = this.requireKek();
    const { framed } = aesGcmEncrypt(dek, kek);
    return { wrappedDek: framed, kekKeyId: this.kekKeyId };
  }

  /**
   * Unwrap DEK from framed blob. `kekKeyId` reserved for multi-key rotation;
   * MVP accepts only the process KEK id (local/v1 or PHOTO_KEK_ID).
   */
  unwrapDek(wrappedDek: Buffer, kekKeyId?: string | null): Buffer {
    if (kekKeyId && kekKeyId !== this.kekKeyId) {
      throw new Error(`UNSUPPORTED_KEK_KEY_ID:${kekKeyId}`);
    }
    const kek = this.requireKek();
    const dek = aesGcmDecrypt(wrappedDek, kek);
    if (dek.length !== AES_256_KEY_LEN) {
      throw new Error('Unwrapped DEK has invalid length');
    }
    return dek;
  }

  /** Generate a fresh 32-byte DEK (server-side use / tests). */
  generateDek(): Buffer {
    return randomBytes(AES_256_KEY_LEN);
  }
}
