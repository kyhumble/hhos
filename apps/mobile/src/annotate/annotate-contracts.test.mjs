/**
 * PR 11 source contracts: online-only annotations, measurements PATCH, no outbox.
 * Pure .mjs — no native modules.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const mobileSrc = path.resolve(root, '..');
const mobileRoot = path.resolve(root, '../..');

function read(rel) {
  return readFileSync(path.resolve(root, rel), 'utf8');
}

function readSrc(rel) {
  return readFileSync(path.resolve(mobileSrc, rel), 'utf8');
}

describe('no annotation_outbox', () => {
  it('does not create annotation_outbox module or table', () => {
    const annotateDir = path.resolve(root);
    const files = readdirSync(annotateDir);
    assert.ok(!files.some((f) => /outbox/i.test(f)), 'no outbox files in annotate/');

    const outboxDir = path.resolve(mobileSrc, 'outbox');
    if (existsSync(outboxDir)) {
      const outboxFiles = readdirSync(outboxDir);
      assert.ok(
        !outboxFiles.some((f) => /annot/i.test(f)),
        'photo outbox must not include annotation queue',
      );
      for (const f of outboxFiles) {
        if (!f.endsWith('.ts') && !f.endsWith('.mjs')) continue;
        const src = readFileSync(path.join(outboxDir, f), 'utf8');
        assert.doesNotMatch(
          src,
          /annotation_outbox|annotOutbox|ANNOTATION_OUTBOX/,
        );
      }
    }

    const upload = read('upload-annotation.ts');
    // Explicitly documents absence of offline queue; must not implement one
    assert.match(upload, /No annotation_outbox/);
    assert.doesNotMatch(upload, /enqueueAnnotation|createAnnotationOutbox/);
    assert.match(upload, /online-only|Online-only/i);
  });
});

describe('annotation online-only gates', () => {
  it('probes connectivity and blocks offline annotate UI', () => {
    const online = read('online.ts');
    assert.match(online, /probeOnline/);
    assert.match(online, /ANNOTATE_OFFLINE_MESSAGE/);
    assert.match(online, /ANNOTATE_PARENT_NOT_AVAILABLE_MESSAGE/);

    const panel = read('AnnotatePanel.tsx');
    assert.match(panel, /probeOnline/);
    assert.match(panel, /ANNOTATE_OFFLINE_MESSAGE/);
    assert.match(panel, /parentAvailable/);
    assert.match(panel, /Annotate disabled offline|annotateAllowed/);
  });

  it('upload path requires probeOnline + ensureDeviceRegistered + child DEK', () => {
    const upload = read('upload-annotation.ts');
    assert.match(upload, /probeOnline/);
    assert.match(upload, /ensureDeviceRegistered/);
    assert.match(upload, /setAnnotDek|annot-dek/);
    assert.match(upload, /initiateAnnotationUpload/);
    assert.match(upload, /wrapAnnotationDek/);
    assert.match(upload, /putPresignedCipher/);
    assert.match(upload, /completeAnnotationUpload/);
    assert.match(upload, /clearAnnotDek/);
    assert.match(upload, /do not rewrite host|K25/);
    // Must not use parent photo DEK
    assert.doesNotMatch(upload, /getPhotoDek|photo-dek/);
  });
});

describe('measurements PATCH API client', () => {
  it('exposes PATCH /v1/wound-photos/:id/measurements', () => {
    const api = readSrc('api/wound-photos.ts');
    assert.match(api, /patchWoundPhotoMeasurements/);
    assert.match(api, /\/v1\/wound-photos\/\$\{photoId\}\/measurements/);
    assert.match(api, /method:\s*['"]PATCH['"]/);
    assert.match(api, /initiateAnnotationUpload/);
    assert.match(api, /annotations\/uploads/);
    assert.match(api, /\/v1\/annotations\/\$\{annotationId\}\/wrap-dek/);
    assert.match(api, /\/v1\/annotations\/\$\{annotationId\}\/complete/);
  });

  it('MeasurementsForm uses online PATCH and non-blocking large-wound notice', () => {
    const form = read('MeasurementsForm.tsx');
    assert.match(form, /patchWoundPhotoMeasurements/);
    assert.match(form, /LARGE_WOUND_NOTICE|Large wound notice/);
    assert.match(form, /non-blocking/i);
    // Notice must not disable save
    assert.doesNotMatch(form, /disabled=\{.*showLargeNotice/);
  });
});

describe('SecureKeys.annotDek', () => {
  it('defines hhos.annot-dek.{clientAnnotationId} pattern', () => {
    const keys = readSrc('secure/keys.ts');
    assert.match(keys, /hhos\.annot-dek\.\$\{clientAnnotationId\}/);
    assert.match(keys, /annotDek:/);
  });

  it('annot-dek-store uses SecureKeys.annotDek only', () => {
    const store = readSrc('secure/annot-dek-store.ts');
    assert.match(store, /SecureKeys\.annotDek/);
    assert.match(store, /setAnnotDek|clearAnnotDek/);
  });
});

describe('large-wound client thresholds', () => {
  it('matches server defaults 10cm / 10cm / 50cm2', () => {
    const src = read('large-wound.ts');
    assert.match(src, /largeWoundLengthCm:\s*10/);
    assert.match(src, /largeWoundWidthCm:\s*10/);
    assert.match(src, /largeWoundAreaCm2:\s*50/);
    assert.match(src, /LARGE_WOUND_NOTICE/);
  });
});

describe('review screens wired', () => {
  it('registers photos and photo-review routes', () => {
    const layout = readFileSync(
      path.resolve(mobileRoot, 'app/_layout.tsx'),
      'utf8',
    );
    assert.match(layout, /photos/);
    assert.match(layout, /photo-review/);
    assert.ok(existsSync(path.resolve(mobileRoot, 'app/photos.tsx')));
    assert.ok(existsSync(path.resolve(mobileRoot, 'app/photo-review.tsx')));
  });
});
