/**
 * Large-wound flag computation (K29).
 * PR 5b stores is_large_wound only — clinical_tasks rows are owned by PR 7.
 */

export type LargeWoundThresholds = {
  largeWoundLengthCm?: number;
  largeWoundWidthCm?: number;
  largeWoundAreaCm2?: number;
};

export const DEFAULT_LARGE_WOUND_THRESHOLDS = {
  largeWoundLengthCm: 10,
  largeWoundWidthCm: 10,
  largeWoundAreaCm2: 50,
} as const;

/**
 * Recompute is_large_wound from optional measurements + org thresholds.
 * Missing length/width do not force true; only present dimensions are evaluated.
 */
export function computeIsLargeWound(
  lengthCm: number | null | undefined,
  widthCm: number | null | undefined,
  settings?: LargeWoundThresholds | null,
): boolean {
  const lenTh =
    settings?.largeWoundLengthCm ?? DEFAULT_LARGE_WOUND_THRESHOLDS.largeWoundLengthCm;
  const widTh =
    settings?.largeWoundWidthCm ?? DEFAULT_LARGE_WOUND_THRESHOLDS.largeWoundWidthCm;
  const areaTh =
    settings?.largeWoundAreaCm2 ?? DEFAULT_LARGE_WOUND_THRESHOLDS.largeWoundAreaCm2;

  const L =
    lengthCm === null || lengthCm === undefined || Number.isNaN(lengthCm)
      ? null
      : lengthCm;
  const W =
    widthCm === null || widthCm === undefined || Number.isNaN(widthCm) ? null : widthCm;

  if (L !== null && L >= lenTh) return true;
  if (W !== null && W >= widTh) return true;
  if (L !== null && W !== null && L * W >= areaTh) return true;
  return false;
}

/** Parse numeric DB column (string | number | null) to number | null. */
export function parseNumericCm(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}
