import { z } from 'zod';
import { ReferralAcuity, ReferralSourceType } from './enums';

export const CreateReferralSchema = z
  .object({
    patientId: z.string().uuid().optional(),
    /** Inline patient create when patientId omitted */
    patient: z
      .object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        preferredLanguage: z.string().default('en'),
      })
      .optional(),
    externalRef: z.string().max(100).optional(),
    sourceType: z.enum(ReferralSourceType),
    sourceName: z.string().min(1).max(200),
    sourceContact: z.string().max(200).optional(),
    receivedAt: z.string().datetime().optional(),
    acuity: z.enum(ReferralAcuity).optional(),
    reasonForReferral: z.string().min(1).max(2000),
    primaryDiagnosisText: z.string().max(500).optional(),
    primaryDiagnosisIcd10: z.string().max(10).optional(),
    requestedServices: z.array(z.string()).default(['wound']),
  })
  .refine((d) => d.patientId || d.patient, {
    message: 'patientId or patient is required',
  });

export type CreateReferralInput = z.infer<typeof CreateReferralSchema>;

/**
 * Free-form status is not allowed — accept/decline use dedicated endpoints.
 * Only non-terminal workflow transitions (e.g. new → in_review) via PATCH.
 */
export const UpdateReferralSchema = z.object({
  status: z.enum(['new', 'in_review']).optional(),
  acuity: z.enum(ReferralAcuity).optional(),
  reasonForReferral: z.string().max(2000).optional(),
  primaryDiagnosisText: z.string().max(500).optional(),
  primaryDiagnosisIcd10: z.string().max(10).optional(),
  intakeOwnerId: z.string().uuid().nullable().optional(),
});

export type UpdateReferralInput = z.infer<typeof UpdateReferralSchema>;

export const DeclineReferralSchema = z.object({
  reason: z.string().min(1).max(1000),
});

export type DeclineReferralInput = z.infer<typeof DeclineReferralSchema>;
