/**
 * Simple in-process token-bucket-style rate limit for wrap-dek (per user).
 * Design: ~30 wrap/min. Not multi-instance fair — MVP only.
 */

const WINDOW_MS = 60_000;
const DEFAULT_MAX_PER_WINDOW = 30;

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

export function allowWrapDek(
  userId: string,
  now = Date.now(),
  maxPerWindow = DEFAULT_MAX_PER_WINDOW,
): boolean {
  let bucket = buckets.get(userId);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(userId, bucket);
  }

  const cutoff = now - WINDOW_MS;
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= maxPerWindow) {
    return false;
  }

  bucket.timestamps.push(now);
  return true;
}

/** Test hook — clear all buckets. */
export function resetWrapRateLimitForTests(): void {
  buckets.clear();
}
