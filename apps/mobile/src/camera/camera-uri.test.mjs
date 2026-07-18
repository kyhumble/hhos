/**
 * Pure allowlist tests for clinical camera URIs (no native modules).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/**
 * Mirror of isAllowedCameraCaptureUri — keep in sync with camera-uri.ts.
 * Drift checklist: scheme gate, .. reject, sandbox prefix, empty roots fail-closed.
 */
function isAllowedCameraCaptureUri(uri, sandboxRoots) {
  if (!uri || typeof uri !== 'string') return false;
  const trimmed = uri.trim();
  if (!trimmed) return false;
  if (trimmed.includes('..')) return false;

  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(trimmed);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (scheme !== 'file') return false;
  } else if (!trimmed.startsWith('/')) {
    return false;
  }

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('content://') ||
    lower.startsWith('ph://') ||
    lower.startsWith('assets-library://') ||
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('data:') ||
    lower.startsWith('blob:')
  ) {
    return false;
  }

  const roots = sandboxRoots.map((s) => s.trim()).filter((r) => r.length > 0);
  if (roots.length === 0) return false;

  const candidates = expandUriForms(trimmed);
  for (const root of roots) {
    const rootForms = expandUriForms(root);
    for (const r of rootForms) {
      if (!r) continue;
      for (const c of candidates) {
        if (c.startsWith(r)) return true;
      }
    }
  }
  return false;
}

function expandUriForms(s) {
  const out = new Set([s]);
  try {
    out.add(decodeURIComponent(s));
  } catch {
    // ignore
  }
  if (s.startsWith('file://')) {
    const without = s.slice('file://'.length);
    out.add(without);
    try {
      out.add(decodeURIComponent(without));
    } catch {
      // ignore
    }
  } else if (s.startsWith('/')) {
    out.add(`file://${s}`);
  }
  return [...out];
}

const CACHE = 'file:///data/user/0/com.hhos.field/cache/';
const DOC = 'file:///data/user/0/com.hhos.field/files/';
const ROOTS = [CACHE, DOC];

describe('isAllowedCameraCaptureUri allowlist', () => {
  it('allows expo-camera style paths under cache', () => {
    assert.equal(
      isAllowedCameraCaptureUri(
        `${CACHE}Camera/ImageManipulator/abc.jpg`,
        ROOTS,
      ),
      true,
    );
    assert.equal(
      isAllowedCameraCaptureUri(
        `${CACHE}ExponentExperienceData/Camera/photo.jpg`,
        ROOTS,
      ),
      true,
    );
  });

  it('allows absolute path form under document dir', () => {
    assert.equal(
      isAllowedCameraCaptureUri(
        '/data/user/0/com.hhos.field/files/ImageManipulator/x.jpg',
        ROOTS,
      ),
      true,
    );
  });

  it('rejects gallery / media-provider schemes', () => {
    const forbidden = [
      'ph://ABC-123',
      'assets-library://asset/id=XYZ',
      'content://media/external/images/media/1',
      'content://com.android.providers.media.documents/document/image%3A1',
      'content://media/picker/0/com.android.providers.media.photopicker/media/1',
      'https://example.com/photo.jpg',
      'http://example.com/photo.jpg',
      'data:image/jpeg;base64,aaaa',
      'blob:https://example.com/uuid',
    ];
    for (const uri of forbidden) {
      assert.equal(
        isAllowedCameraCaptureUri(uri, ROOTS),
        false,
        `expected reject: ${uri}`,
      );
    }
  });

  it('rejects file:// outside app sandbox (DCIM / Downloads)', () => {
    assert.equal(
      isAllowedCameraCaptureUri('file:///storage/emulated/0/DCIM/Camera/a.jpg', ROOTS),
      false,
    );
    assert.equal(
      isAllowedCameraCaptureUri(
        'file:///storage/emulated/0/Download/wound.jpg',
        ROOTS,
      ),
      false,
    );
  });

  it('rejects path traversal', () => {
    assert.equal(
      isAllowedCameraCaptureUri(`${CACHE}../files/secret.jpg`, ROOTS),
      false,
    );
  });

  it('fails closed when no sandbox roots', () => {
    assert.equal(
      isAllowedCameraCaptureUri(`${CACHE}photo.jpg`, []),
      false,
    );
  });
});
