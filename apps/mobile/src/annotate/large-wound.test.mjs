/**
 * Client large-wound computation unit tests (mirrors API defaults).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// Inline pure logic (mirrors large-wound.ts) to avoid TS import in node:test
const DEFAULT = {
  largeWoundLengthCm: 10,
  largeWoundWidthCm: 10,
  largeWoundAreaCm2: 50,
};

function computeIsLargeWoundClient(lengthCm, widthCm) {
  const L =
    lengthCm === null || lengthCm === undefined || Number.isNaN(lengthCm)
      ? null
      : lengthCm;
  const W =
    widthCm === null || widthCm === undefined || Number.isNaN(widthCm)
      ? null
      : widthCm;
  if (L !== null && L >= DEFAULT.largeWoundLengthCm) return true;
  if (W !== null && W >= DEFAULT.largeWoundWidthCm) return true;
  if (L !== null && W !== null && L * W >= DEFAULT.largeWoundAreaCm2) return true;
  return false;
}

describe('computeIsLargeWoundClient', () => {
  it('false when missing both dimensions', () => {
    assert.equal(computeIsLargeWoundClient(null, null), false);
    assert.equal(computeIsLargeWoundClient(undefined, undefined), false);
  });

  it('true when length >= 10', () => {
    assert.equal(computeIsLargeWoundClient(10, 1), true);
    assert.equal(computeIsLargeWoundClient(12, null), true);
  });

  it('true when width >= 10', () => {
    assert.equal(computeIsLargeWoundClient(1, 10), true);
  });

  it('true when area >= 50', () => {
    assert.equal(computeIsLargeWoundClient(8, 7), true); // 56
  });

  it('false below all thresholds', () => {
    assert.equal(computeIsLargeWoundClient(5, 5), false); // 25
    assert.equal(computeIsLargeWoundClient(9, 5), false);
  });
});
