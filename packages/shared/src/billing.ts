import { z } from 'zod';
import { BillingClaimType, BillingGapCode, BillingGapSeverity } from './enums';

export const BillingGapSchema = z.object({
  code: z.enum(BillingGapCode),
  severity: z.enum(BillingGapSeverity),
  message: z.string(),
});
export type BillingGap = z.infer<typeof BillingGapSchema>;

export const CreateBillingClaimSchema = z.object({
  episodeId: z.string().uuid(),
  claimType: z.enum(BillingClaimType),
  serviceFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  serviceTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  notes: z.string().max(2000).optional(),
});
export type CreateBillingClaimInput = z.infer<typeof CreateBillingClaimSchema>;

export const MarkClaimSubmittedSchema = z.object({
  externalRef: z.string().min(1).max(100),
  note: z.string().max(2000).optional(),
});
export type MarkClaimSubmittedInput = z.infer<typeof MarkClaimSubmittedSchema>;

export type BillingReadinessResult = {
  episodeId: string;
  careType: string;
  claimTypeHint: string;
  ready: boolean;
  hardGapCount: number;
  softGapCount: number;
  gaps: BillingGap[];
  snapshot: Record<string, unknown>;
};
