import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computeIsLargeWound,
  DEFAULT_LARGE_WOUND_THRESHOLDS,
  parseNumericCm,
} from './large-wound';

describe('computeIsLargeWound (K29 flag only)', () => {
  it('defaults: length >= 10 is large', () => {
    assert.equal(computeIsLargeWound(10, 1), true);
    assert.equal(computeIsLargeWound(9.9, 1), false);
  });

  it('defaults: width >= 10 is large', () => {
    assert.equal(computeIsLargeWound(1, 10), true);
    assert.equal(computeIsLargeWound(1, 9.9), false);
  });

  it('defaults: area >= 50 is large', () => {
    assert.equal(computeIsLargeWound(8, 7), true); // 56
    assert.equal(computeIsLargeWound(7, 7), false); // 49
  });

  it('missing dimensions are not large', () => {
    assert.equal(computeIsLargeWound(undefined, undefined), false);
    assert.equal(computeIsLargeWound(null, null), false);
    assert.equal(computeIsLargeWound(15, undefined), true); // length alone
    assert.equal(computeIsLargeWound(undefined, 15), true); // width alone
    assert.equal(computeIsLargeWound(8, undefined), false); // no area without both
  });

  it('respects org thresholds', () => {
    assert.equal(
      computeIsLargeWound(5, 5, {
        largeWoundLengthCm: 4,
        largeWoundWidthCm: 20,
        largeWoundAreaCm2: 100,
      }),
      true,
    );
    assert.equal(
      computeIsLargeWound(5, 5, {
        largeWoundLengthCm: 10,
        largeWoundWidthCm: 10,
        largeWoundAreaCm2: 100,
      }),
      false,
    );
  });

  it('exports default thresholds matching design', () => {
    assert.equal(DEFAULT_LARGE_WOUND_THRESHOLDS.largeWoundLengthCm, 10);
    assert.equal(DEFAULT_LARGE_WOUND_THRESHOLDS.largeWoundWidthCm, 10);
    assert.equal(DEFAULT_LARGE_WOUND_THRESHOLDS.largeWoundAreaCm2, 50);
  });
});

describe('parseNumericCm', () => {
  it('parses strings and numbers', () => {
    assert.equal(parseNumericCm('12.50'), 12.5);
    assert.equal(parseNumericCm(3), 3);
    assert.equal(parseNumericCm(null), null);
    assert.equal(parseNumericCm(''), null);
    assert.equal(parseNumericCm('nope'), null);
  });
});
