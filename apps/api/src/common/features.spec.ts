import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  featureEnabled,
  isPhotoGeotagEnvEnabled,
  isWoundPhotosEnabled,
} from './features';

describe('featureEnabled', () => {
  const keys = [
    'FEATURE_WOUND_PHOTOS',
    'PHOTO_GEOTAG_ENABLED',
    'FEATURE_TEST_FLAG',
  ] as const;
  const snapshot = Object.fromEntries(keys.map((k) => [k, process.env[k]]));

  afterEach(() => {
    for (const k of keys) {
      const v = snapshot[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('returns default when unset', () => {
    delete process.env.FEATURE_TEST_FLAG;
    assert.equal(featureEnabled('FEATURE_TEST_FLAG'), false);
    assert.equal(featureEnabled('FEATURE_TEST_FLAG', true), true);
  });

  it('returns default when empty string', () => {
    process.env.FEATURE_TEST_FLAG = '';
    assert.equal(featureEnabled('FEATURE_TEST_FLAG', false), false);
  });

  it('accepts 1 / true / yes (case-insensitive)', () => {
    process.env.FEATURE_TEST_FLAG = '1';
    assert.equal(featureEnabled('FEATURE_TEST_FLAG'), true);
    process.env.FEATURE_TEST_FLAG = 'true';
    assert.equal(featureEnabled('FEATURE_TEST_FLAG'), true);
    process.env.FEATURE_TEST_FLAG = 'TRUE';
    assert.equal(featureEnabled('FEATURE_TEST_FLAG'), true);
    process.env.FEATURE_TEST_FLAG = 'yes';
    assert.equal(featureEnabled('FEATURE_TEST_FLAG'), true);
    process.env.FEATURE_TEST_FLAG = 'Yes';
    assert.equal(featureEnabled('FEATURE_TEST_FLAG'), true);
  });

  it('rejects other values', () => {
    process.env.FEATURE_TEST_FLAG = '0';
    assert.equal(featureEnabled('FEATURE_TEST_FLAG', true), false);
    process.env.FEATURE_TEST_FLAG = 'false';
    assert.equal(featureEnabled('FEATURE_TEST_FLAG', true), false);
    process.env.FEATURE_TEST_FLAG = 'on';
    assert.equal(featureEnabled('FEATURE_TEST_FLAG', true), false);
  });

  it('isWoundPhotosEnabled defaults false', () => {
    delete process.env.FEATURE_WOUND_PHOTOS;
    assert.equal(isWoundPhotosEnabled(), false);
    process.env.FEATURE_WOUND_PHOTOS = 'true';
    assert.equal(isWoundPhotosEnabled(), true);
  });

  it('isPhotoGeotagEnvEnabled is fail-closed', () => {
    delete process.env.PHOTO_GEOTAG_ENABLED;
    assert.equal(isPhotoGeotagEnvEnabled(), false);
    process.env.PHOTO_GEOTAG_ENABLED = '';
    assert.equal(isPhotoGeotagEnvEnabled(), false);
    process.env.PHOTO_GEOTAG_ENABLED = 'false';
    assert.equal(isPhotoGeotagEnvEnabled(), false);
    process.env.PHOTO_GEOTAG_ENABLED = 'true';
    assert.equal(isPhotoGeotagEnvEnabled(), true);
    process.env.PHOTO_GEOTAG_ENABLED = '1';
    assert.equal(isPhotoGeotagEnvEnabled(), true);
  });
});
