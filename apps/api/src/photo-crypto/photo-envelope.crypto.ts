/**
 * PHOTO_KEK envelope: wrap/unwrap per-object DEKs (K3, K4, K19).
 * Framing matches field-crypto / shared PHOTO_CRYPTO_VECTORS (iv||tag||ciphertext).
 * Separate key material from FIELD_ENCRYPTION_KEY.
 *
 * PHOTO_KEK must be exactly 64 hex chars or standard base64 of 32 bytes.
 * Invalid formats are rejected (no SHA-256 derivation fallback).
 */
import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import {
  AES_256_KEY_LEN,
  aesGcmDecrypt,
  aesGcmEncrypt,
} from './aes-gcm-frame';

/** Local single-deployment KEK id until KMS multi-key rotation lands. */
export const LOCAL_PHOTO_KEK_ID = 'local/v1';

/**
 * Parse PHOTO_KEK strictly: 64 hex chars or 32-byte base64 only.
 * Returns null when unset/empty or when format is invalid (fail-closed).
 */
export function resolvePhotoKek(
  raw: string | undefined = process.env.PHOTO_KEK,
): { key: Buffer } | { error: 'missing' | 'invalid' } {
  if (raw === undefined || raw.length === 0) {
    return { error: 'missing' };
  }

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return { key: Buffer.from(raw, 'hex') };
  }

  try {
    const b = Buffer.from(raw, 'base64');
    if (b.length === AES_256_KEY_LEN) {
      return { key: b };
    }
  } catch {
    // fall through to invalid
  }

  return { error: 'invalid' };
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
    const resolved = resolvePhotoKek();
    if ('key' in resolved) {
      this.kek = resolved.key;
    } else if (resolved.error === 'invalid') {
      this.kek = null;
      this.logger.error(
        'PHOTO_KEK is set but invalid — must be 64 hex chars or 32-byte base64 (no derivation). Wrap/unwrap disabled.',
      );
    } else {
      this.kek = null;
      this.logger.warn(
        'PHOTO_KEK not configured — wrap/unwrap will fail until set',
      );
    }

    const configuredId = process.env.PHOTO_KEK_ID?.trim();
    if (configuredId) this.kekKeyId = configuredId;

    if (this.kek) {
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
