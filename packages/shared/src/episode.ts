import { z } from 'zod';
import {
  CareTeamRole,
  CareType,
  EpisodeStatus,
  F2fStatus,
  OrdersStatus,
  PocStatus,
} from './enums';

/**
 * intakeStatus is derived from checklist recompute — not client-writable.
 */
export const UpdateEpisodeSchema = z.object({
  status: z.enum(EpisodeStatus).optional(),
  careType: z.enum(CareType).optional(),
  socScheduledAt: z.string().datetime().nullable().optional(),
  socCompletedAt: z.string().datetime().nullable().optional(),
  socClinicianId: z.string().uuid().nullable().optional(),
  primaryDxIcd10: z.string().max(10).nullable().optional(),
  admissionSource: z.string().max(100).nullable().optional(),
  f2fStatus: z.enum(F2fStatus).optional(),
  f2fDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  ordersStatus: z.enum(OrdersStatus).optional(),
  pocStatus: z.enum(PocStatus).optional(),
  nonAdmitReason: z.string().max(1000).nullable().optional(),
});

export type UpdateEpisodeInput = z.infer<typeof UpdateEpisodeSchema>;

export const AssignCareTeamSchema = z.object({
  userId: z.string().uuid(),
  teamRole: z.enum(CareTeamRole),
  active: z.boolean().default(true),
});

export type AssignCareTeamInput = z.infer<typeof AssignCareTeamSchema>;
