import { randomBytes } from 'node:crypto';

/**
 * Org-unique MRN generator. Collision-resistant; callers should retry insert
 * on unique violation if needed.
 */
export function generateMrn(): string {
  const n = randomBytes(4).readUInt32BE(0) % 100_000_000;
  return `MRN-${String(n).padStart(8, '0')}`;
}
