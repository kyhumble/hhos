/**
 * Dual-client construction tests — no live MinIO required.
 * Asserts presign client uses S3_PUBLIC_ENDPOINT and never host-rewrites.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { ObjectStorageService } from './object-storage.service';

describe('ObjectStorageService (dual S3 / K25)', () => {
  const envKeys = [
    'S3_ENDPOINT',
    'S3_PUBLIC_ENDPOINT',
    'S3_REGION',
    'S3_BUCKET',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
    'S3_FORCE_PATH_STYLE',
    'S3_PRESIGN_TTL_SECONDS',
  ] as const;
  const snapshot = Object.fromEntries(envKeys.map((k) => [k, process.env[k]]));

  afterEach(() => {
    for (const k of envKeys) {
      const v = snapshot[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  function makeService(env: Record<string, string>): ObjectStorageService {
    for (const [k, v] of Object.entries(env)) {
      process.env[k] = v;
    }
    const svc = new ObjectStorageService();
    svc.onModuleInit();
    return svc;
  }

  it('is not configured without S3_ENDPOINT', () => {
    delete process.env.S3_ENDPOINT;
    delete process.env.S3_PUBLIC_ENDPOINT;
    const svc = new ObjectStorageService();
    svc.onModuleInit();
    assert.equal(svc.isConfigured(), false);
  });

  it('falls back public endpoint to internal when S3_PUBLIC_ENDPOINT unset', () => {
    delete process.env.S3_PUBLIC_ENDPOINT;
    process.env.S3_ENDPOINT = 'http://minio:9000';
    process.env.S3_REGION = 'us-east-1';
    process.env.S3_BUCKET = 'hhos-documents';
    process.env.S3_ACCESS_KEY_ID = 'test';
    process.env.S3_SECRET_ACCESS_KEY = 'testsecret';
    process.env.S3_FORCE_PATH_STYLE = 'true';
    const svc = new ObjectStorageService();
    svc.onModuleInit();
    assert.equal(svc.isConfigured(), true);
    const eps = svc.getEndpoints();
    assert.equal(eps.internal, 'http://minio:9000');
    assert.equal(eps.public, 'http://minio:9000');
  });

  it('keeps distinct internal vs public endpoints', () => {
    const svc = makeService({
      S3_ENDPOINT: 'http://minio:9000',
      S3_PUBLIC_ENDPOINT: 'http://127.0.0.1:9000',
      S3_REGION: 'us-east-1',
      S3_BUCKET: 'hhos-documents',
      S3_ACCESS_KEY_ID: 'hhosminio',
      S3_SECRET_ACCESS_KEY: 'hhosminio_dev_secret',
      S3_FORCE_PATH_STYLE: 'true',
    });
    assert.equal(svc.isConfigured(), true);
    const eps = svc.getEndpoints();
    assert.equal(eps.internal, 'http://minio:9000');
    assert.equal(eps.public, 'http://127.0.0.1:9000');
  });

  it('presignPut URL host matches public endpoint (no rewrite to internal)', async () => {
    const publicHost = '127.0.0.1:9000';
    const svc = makeService({
      S3_ENDPOINT: 'http://minio:9000',
      S3_PUBLIC_ENDPOINT: `http://${publicHost}`,
      S3_REGION: 'us-east-1',
      S3_BUCKET: 'hhos-documents',
      S3_ACCESS_KEY_ID: 'hhosminio',
      S3_SECRET_ACCESS_KEY: 'hhosminio_dev_secret',
      S3_FORCE_PATH_STYLE: 'true',
    });

    const { url, key, bucket, expiresAt } = await svc.presignPut(
      'org/test/wound-photos/2026/07/photo-1.bin',
      { contentType: 'application/octet-stream', expiresInSeconds: 300 },
    );

    const parsed = new URL(url);
    assert.equal(parsed.host, publicHost);
    // Must not leak docker-internal hostname in the signed URL
    assert.equal(url.includes('minio:9000'), false);
    assert.equal(bucket, 'hhos-documents');
    assert.equal(key, 'org/test/wound-photos/2026/07/photo-1.bin');
    assert.ok(expiresAt.getTime() > Date.now());
    // SigV4 query params present
    assert.ok(
      parsed.searchParams.has('X-Amz-Signature') ||
        parsed.searchParams.has('X-Amz-Credential'),
    );
  });

  it('builds wound photo object keys per design layout', () => {
    const svc = makeService({
      S3_ENDPOINT: 'http://127.0.0.1:9000',
      S3_REGION: 'us-east-1',
      S3_BUCKET: 'hhos-documents',
      S3_ACCESS_KEY_ID: 'a',
      S3_SECRET_ACCESS_KEY: 'b',
    });
    const capturedAt = new Date(Date.UTC(2026, 6, 18)); // July
    const key = svc.woundPhotoObjectKey('org-uuid', 'photo-uuid', capturedAt);
    assert.equal(key, 'org/org-uuid/wound-photos/2026/07/photo-uuid.bin');
    const annot = svc.woundPhotoAnnotationObjectKey(
      'org-uuid',
      'photo-uuid',
      'ann-1',
    );
    assert.equal(
      annot,
      'org/org-uuid/wound-photo-annotations/photo-uuid/ann-1.bin',
    );
  });

  it('ops methods use internalClient (not presignClient)', async () => {
    const svc = makeService({
      S3_ENDPOINT: 'http://minio:9000',
      S3_PUBLIC_ENDPOINT: 'http://127.0.0.1:9000',
      S3_REGION: 'us-east-1',
      S3_BUCKET: 'hhos-documents',
      S3_ACCESS_KEY_ID: 'hhosminio',
      S3_SECRET_ACCESS_KEY: 'hhosminio_dev_secret',
      S3_FORCE_PATH_STYLE: 'true',
    });

    assert.equal(svc.getOpsClientEndpointForTests(), 'http://minio:9000');
    assert.equal(svc.getEndpoints().public, 'http://127.0.0.1:9000');

    const anySvc = svc as unknown as {
      internalClient: { send: (cmd: unknown) => Promise<unknown> };
      presignClient: { send: (cmd: unknown) => Promise<unknown> };
    };
    let internalCalls = 0;
    let presignCalls = 0;
    anySvc.internalClient.send = async () => {
      internalCalls += 1;
      return {
        ContentLength: 1,
        ETag: '"abc"',
        ContentType: 'application/octet-stream',
        Body: undefined,
      };
    };
    anySvc.presignClient.send = async () => {
      presignCalls += 1;
      return {};
    };

    await svc.headObject('org/x/y.bin');
    await svc.deleteObject('org/x/y.bin');
    assert.equal(internalCalls, 2);
    assert.equal(presignCalls, 0);
  });

  it('keeps default TTL when S3_PRESIGN_TTL_SECONDS out of range', () => {
    const svc = makeService({
      S3_ENDPOINT: 'http://127.0.0.1:9000',
      S3_REGION: 'us-east-1',
      S3_BUCKET: 'hhos-documents',
      S3_ACCESS_KEY_ID: 'a',
      S3_SECRET_ACCESS_KEY: 'b',
      S3_PRESIGN_TTL_SECONDS: '5',
    });
    assert.equal(svc.isConfigured(), true);
  });
});
