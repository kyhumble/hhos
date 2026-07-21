import { z } from 'zod';
import { ReferralAcuity, ReferralSourceType } from './enums';

/** Structured fields pulled from a referral document or email (HITL review). */
export const ExtractedReferralSchema = z.object({
  patient: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
  sourceType: z.enum(ReferralSourceType).optional(),
  sourceName: z.string().optional(),
  sourceContact: z.string().optional(),
  acuity: z.enum(ReferralAcuity).optional(),
  reasonForReferral: z.string().optional(),
  primaryDiagnosisText: z.string().optional(),
  primaryDiagnosisIcd10: z.string().optional(),
  externalRef: z.string().optional(),
  confidence: z.number().min(0).max(1),
  factors: z.array(z.string()),
});

export type ExtractedReferral = z.infer<typeof ExtractedReferralSchema>;

export const IngestReferralDocumentSchema = z.object({
  /** Plain text from PDF extract, email body, or pasted discharge summary */
  text: z.string().min(1).max(200_000),
  fileName: z.string().max(300).optional(),
  /** When true, create patient + referral in in_review (still requires Accept for intake) */
  createDraft: z.boolean().optional().default(true),
  sourceHint: z.enum(ReferralSourceType).optional(),
});

export type IngestReferralDocumentInput = z.infer<typeof IngestReferralDocumentSchema>;

/** Inbound email payload (SendGrid/Mailgun-style or internal forwarder). */
export const InboundReferralEmailSchema = z.object({
  from: z.string().min(1).max(500),
  to: z.string().min(1).max(500).optional(),
  subject: z.string().max(500).optional(),
  text: z.string().min(1).max(200_000),
  html: z.string().max(500_000).optional(),
  messageId: z.string().max(300).optional(),
  receivedAt: z.string().datetime().optional(),
});

export type InboundReferralEmailInput = z.infer<typeof InboundReferralEmailSchema>;
