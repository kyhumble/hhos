import type { PurposeCode } from '@hhos/shared';

/**
 * Clinical wound photo purpose from shared contracts.
 * Capture/view gate always requires this purpose code.
 */
export const CLINICAL_PHOTO_PURPOSE = 'WOUND_PHOTO_CLINICAL' satisfies PurposeCode;
