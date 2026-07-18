import { z } from 'zod';
import { ConsentCaptureMethod, ConsentType, SignerType } from './enums';

export const CaptureConsentSchema = z.object({
  templateId: z.string().uuid(),
  episodeId: z.string().uuid().optional(),
  captureMethod: z.enum(ConsentCaptureMethod),
  signerType: z.enum(SignerType),
  signerName: z.string().min(1).max(200),
  signerRelationship: z.string().max(100).optional(),
  patientPresent: z.boolean().default(true),
  localeUsed: z.string().max(10).default('en'),
  signature: z.object({
    type: z.enum(['drawn', 'typed', 'image_upload']),
    dataBase64: z.string().optional(),
    typedName: z.string().max(200).optional(),
  }),
  notes: z.string().max(2000).optional(),
  expiresAt: z.string().datetime().optional(),
});

export type CaptureConsentInput = z.infer<typeof CaptureConsentSchema>;

export const RevokeConsentSchema = z.object({
  reason: z.string().min(1).max(1000),
  revokedByParty: z.enum(['patient', 'surrogate', 'org']),
  method: z.string().max(100).optional(),
});

export type RevokeConsentInput = z.infer<typeof RevokeConsentSchema>;

export const ConsentTypeSchema = z.enum(ConsentType);
