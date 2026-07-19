/**
 * Client-side large-wound preview (matches server defaults in large-wound.ts).
 * Server is source of truth after PATCH/complete; this is for non-blocking UX notice.
 */
export const DEFAULT_LARGE_WOUND_THRESHOLDS = {
  largeWoundLengthCm: 10,
  largeWoundWidthCm: 10,
  largeWoundAreaCm2: 50,
} as const;

export function computeIsLargeWoundClient(
  lengthCm: number | null | undefined,
  widthCm: number | null | undefined,
): boolean {
  const lenTh = DEFAULT_LARGE_WOUND_THRESHOLDS.largeWoundLengthCm;
  const widTh = DEFAULT_LARGE_WOUND_THRESHOLDS.largeWoundWidthCm;
  const areaTh = DEFAULT_LARGE_WOUND_THRESHOLDS.largeWoundAreaCm2;

  const L =
    lengthCm === null || lengthCm === undefined || Number.isNaN(lengthCm)
      ? null
      : lengthCm;
  const W =
    widthCm === null || widthCm === undefined || Number.isNaN(widthCm)
      ? null
      : widthCm;

  if (L !== null && L >= lenTh) return true;
  if (W !== null && W >= widTh) return true;
  if (L !== null && W !== null && L * W >= areaTh) return true;
  return false;
}

/** Non-blocking banner copy — does not prevent save / continue. */
export const LARGE_WOUND_NOTICE =
  'Large wound criteria met. A clinical lead review task may be opened. You can continue documentation.';
