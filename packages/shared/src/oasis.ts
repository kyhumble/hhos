import { z } from 'zod';
import { OasisAssessmentStatus, OasisTimepoint } from './enums';

export const CreateOasisAssessmentSchema = z.object({
  episodeId: z.string().uuid(),
  timepoint: z.enum(OasisTimepoint).default('SOC'),
  assessmentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export type CreateOasisAssessmentInput = z.infer<typeof CreateOasisAssessmentSchema>;

export const UpsertOasisAnswersSchema = z.object({
  answers: z
    .array(
      z.object({
        itemId: z.string().min(1).max(64),
        value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
      }),
    )
    .min(1)
    .max(200),
});

export type UpsertOasisAnswersInput = z.infer<typeof UpsertOasisAnswersSchema>;

export const SubmitOasisSchema = z.object({
  note: z.string().max(2000).optional(),
});

export const ReviewOasisSchema = z.object({
  action: z.enum(['approve_lock', 'return_draft']),
  note: z.string().max(2000).optional(),
});

export const OasisListQuerySchema = z.object({
  status: z.enum(OasisAssessmentStatus).optional(),
  episodeId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
