/**
 * Ensures SecureKeys.photoDek pattern stays aligned with architecture.
 * Pure .mjs — no native modules.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const keysPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../secure/keys.ts',
);
const keysSrc = readFileSync(keysPath, 'utf8');

describe('SecureKeys.photoDek source contract', () => {
  it('defines photo-dek.{clientPhotoId} pattern', () => {
    assert.match(keysSrc, /hhos\.photo-dek\.\$\{clientPhotoId\}/);
  });

  it('does not store DEKs under a shared constant key', () => {
    assert.doesNotMatch(keysSrc, /photoDek:\s*['"]hhos\.photo-dek['"]/);
  });
});
