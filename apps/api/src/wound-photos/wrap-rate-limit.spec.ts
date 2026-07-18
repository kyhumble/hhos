import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { allowWrapDek, resetWrapRateLimitForTests } from './wrap-rate-limit';

describe('allowWrapDek rate limit', () => {
  beforeEach(() => {
    resetWrapRateLimitForTests();
  });

  it('allows up to maxPerWindow then denies', () => {
    const userId = 'user-a';
    const now = 1_000_000;
    for (let i = 0; i < 30; i++) {
      assert.equal(allowWrapDek(userId, now + i, 30), true);
    }
    assert.equal(allowWrapDek(userId, now + 30, 30), false);
  });

  it('is per-user', () => {
    const now = 2_000_000;
    for (let i = 0; i < 5; i++) {
      assert.equal(allowWrapDek('u1', now, 5), true);
    }
    assert.equal(allowWrapDek('u1', now, 5), false);
    assert.equal(allowWrapDek('u2', now, 5), true);
  });

  it('resets after window', () => {
    const now = 3_000_000;
    assert.equal(allowWrapDek('u', now, 1), true);
    assert.equal(allowWrapDek('u', now + 100, 1), false);
    assert.equal(allowWrapDek('u', now + 60_001, 1), true);
  });
});
