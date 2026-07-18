/**
 * Dual S3 clients (K25):
 *   internalClient  → S3_ENDPOINT          (GET/HEAD/DELETE, complete-time hash)
 *   presignClient   → S3_PUBLIC_ENDPOINT   (SigV4 PUT URLs for devices)
 *
 * NEVER rewrite signed URL hosts after getSignedUrl — Host is part of the signature.
 */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Readable } from 'node:stream';
import { featureEnabled } from '../common/features';

const DEFAULT_PRESIGN_TTL_SECONDS = 10 * 60; // 10 minutes (within 5–15m design range)
const MIN_PRESIGN_TTL_SECONDS = 60;
const MAX_PRESIGN_TTL_SECONDS = 15 * 60;

export interface PresignPutResult {
  /** Fully signed URL — return as-is; do not mutate host. */
  url: string;
  /**
   * Advisory wall-clock expiry for mobile UI countdown only.
   * AWS SigV4 expiry is authoritative; this may skew by a few seconds.
   */
  expiresAt: Date;
  key: string;
  bucket: string;
}

export interface HeadObjectResult {
  contentLength: number | undefined;
  eTag: string | undefined;
  contentType: string | undefined;
}

function buildClientConfig(endpoint: string): S3ClientConfig {
  const region = process.env.S3_REGION ?? 'us-east-1';
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const forcePathStyle = featureEnabled('S3_FORCE_PATH_STYLE', true);

  const config: S3ClientConfig = {
    region,
    endpoint,
    forcePathStyle,
  };

  if (accessKeyId && secretAccessKey) {
    config.credentials = { accessKeyId, secretAccessKey };
  }

  return config;
}

@Injectable()
export class ObjectStorageService implements OnModuleInit {
  private readonly logger = new Logger(ObjectStorageService.name);
  /** Ops only: GET/HEAD/DELETE (internal endpoint). */
  private internalClient!: S3Client;
  /** Presign PUT only (public endpoint). Never use for ops. */
  private presignClient!: S3Client;
  private bucket = '';
  private ready = false;
  private internalEndpoint = '';
  private publicEndpoint = '';
  private presignTtlSeconds = DEFAULT_PRESIGN_TTL_SECONDS;

  onModuleInit(): void {
    const internal = process.env.S3_ENDPOINT?.trim();
    if (!internal) {
      this.logger.warn('S3_ENDPOINT not set — ObjectStorageService disabled');
      return;
    }

    // Public endpoint for device-facing presigns; fall back to internal for API-only dogfood
    const publicEp = process.env.S3_PUBLIC_ENDPOINT?.trim() || internal;

    this.internalEndpoint = internal;
    this.publicEndpoint = publicEp;
    this.bucket = process.env.S3_BUCKET?.trim() || 'hhos-documents';

    const ttlRaw = process.env.S3_PRESIGN_TTL_SECONDS;
    if (ttlRaw !== undefined && ttlRaw !== '') {
      const n = Number.parseInt(ttlRaw, 10);
      if (
        Number.isFinite(n) &&
        n >= MIN_PRESIGN_TTL_SECONDS &&
        n <= MAX_PRESIGN_TTL_SECONDS
      ) {
        this.presignTtlSeconds = n;
      } else {
        this.logger.warn(
          `S3_PRESIGN_TTL_SECONDS="${ttlRaw}" invalid or out of range [${MIN_PRESIGN_TTL_SECONDS}, ${MAX_PRESIGN_TTL_SECONDS}]; using default ${DEFAULT_PRESIGN_TTL_SECONDS}s`,
        );
      }
    }

    this.internalClient = new S3Client(buildClientConfig(internal));
    this.presignClient = new S3Client(buildClientConfig(publicEp));
    this.ready = true;

    this.logger.log(
      `Object storage ready bucket=${this.bucket} internal=${internal} public=${publicEp}`,
    );
  }

  isConfigured(): boolean {
    return this.ready;
  }

  getBucket(): string {
    return this.bucket;
  }

  /** Exposed for tests / diagnostics only — not for URL rewriting. */
  getEndpoints(): { internal: string; public: string } {
    return { internal: this.internalEndpoint, public: this.publicEndpoint };
  }

  /**
   * Test hook: which client endpoint ops use.
   * Confirms K25 split without rewriting any signed URL.
   */
  getOpsClientEndpointForTests(): string {
    return this.internalEndpoint;
  }

  private requireReady(): void {
    if (!this.ready) {
      throw new ServiceUnavailableException({
        code: 'OBJECT_STORAGE_NOT_CONFIGURED',
        message: 'S3_ENDPOINT is not configured',
      });
    }
  }

  /**
   * Presigned PUT for client upload. Signed with presignClient (S3_PUBLIC_ENDPOINT).
   * Callers must return `url` unchanged — never rewrite the host (K25).
   */
  async presignPut(
    key: string,
    options?: {
      contentType?: string;
      expiresInSeconds?: number;
      contentLength?: number;
    },
  ): Promise<PresignPutResult> {
    this.requireReady();
    const expiresIn = options?.expiresInSeconds ?? this.presignTtlSeconds;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: options?.contentType,
      ...(options?.contentLength !== undefined
        ? { ContentLength: options.contentLength }
        : {}),
    });

    // Sign with public endpoint client so SigV4 Host matches the device-reachable URL
    const url = await getSignedUrl(this.presignClient, command, { expiresIn });
    // K25: return URL as-is — do not rewrite host/path after signing
    // expiresAt is advisory wall-clock for UI only (not SigV4 truth)
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    return { url, expiresAt, key, bucket: this.bucket };
  }

  /** Stream object body via internal endpoint (hash-on-complete, decrypt proxy). */
  async getObjectStream(key: string): Promise<Readable> {
    this.requireReady();
    const out = await this.internalClient.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!out.Body) {
      throw new Error(`S3_OBJECT_EMPTY:${key}`);
    }
    // AWS SDK v3 Body is a Readable in Node
    return out.Body as Readable;
  }

  async headObject(key: string): Promise<HeadObjectResult> {
    this.requireReady();
    const out = await this.internalClient.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    return {
      contentLength: out.ContentLength,
      eTag: out.ETag,
      contentType: out.ContentType,
    };
  }

  async deleteObject(key: string): Promise<void> {
    this.requireReady();
    await this.internalClient.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  /** Object key layout for wound photo ciphertext. */
  woundPhotoObjectKey(
    orgId: string,
    photoId: string,
    capturedAt = new Date(),
  ): string {
    const yyyy = capturedAt.getUTCFullYear().toString();
    const mm = String(capturedAt.getUTCMonth() + 1).padStart(2, '0');
    return `org/${orgId}/wound-photos/${yyyy}/${mm}/${photoId}.bin`;
  }

  woundPhotoAnnotationObjectKey(
    orgId: string,
    photoId: string,
    annotationId: string,
  ): string {
    return `org/${orgId}/wound-photo-annotations/${photoId}/${annotationId}.bin`;
  }
}
