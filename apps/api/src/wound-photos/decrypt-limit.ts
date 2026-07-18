/**
 * In-process concurrent decrypt limit for GET .../content (design: max 4).
 * Not multi-instance fair — MVP only. Exceed → 503 DECRYPT_BUSY.
 */

const DEFAULT_MAX_CONCURRENT = 4;

let inFlight = 0;

export function tryAcquireDecryptSlot(
  maxConcurrent = DEFAULT_MAX_CONCURRENT,
): boolean {
  if (inFlight >= maxConcurrent) return false;
  inFlight += 1;
  return true;
}

export function releaseDecryptSlot(): void {
  if (inFlight > 0) inFlight -= 1;
}

/** Test hook — reset in-flight counter. */
export function resetDecryptLimitForTests(): void {
  inFlight = 0;
}

/** Test / metrics hook. */
export function getDecryptInFlightForTests(): number {
  return inFlight;
}
