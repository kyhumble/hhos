import { z } from 'zod';
import { HospiceElectionStatus, HospiceLevelOfCare } from './enums';

export const CreateHospiceElectionSchema = z.object({
  patientId: z.string().uuid(),
  episodeId: z.string().uuid().optional(),
  /** If true and episodeId omitted, creates a new hospice episode. */
  createEpisode: z.boolean().default(true),
  electionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  attendingPhysicianName: z.string().min(1).max(200),
  attendingPhysicianNpi: z
    .string()
    .regex(/^\d{10}$/)
    .optional(),
  certifyingPhysicianName: z.string().min(1).max(200).optional(),
  certifyingPhysicianNpi: z
    .string()
    .regex(/^\d{10}$/)
    .optional(),
  terminalDxIcd10: z.string().min(3).max(12).optional(),
  terminalDxText: z.string().max(500).optional(),
  placeOfService: z
    .enum(['home', 'snf', 'assisted_living', 'inpatient', 'other'])
    .default('home'),
  notes: z.string().max(2000).optional(),
});
export type CreateHospiceElectionInput = z.infer<typeof CreateHospiceElectionSchema>;

export const UpdateHospiceElectionSchema = z.object({
  attendingPhysicianName: z.string().min(1).max(200).optional(),
  attendingPhysicianNpi: z
    .string()
    .regex(/^\d{10}$/)
    .nullable()
    .optional(),
  certifyingPhysicianName: z.string().min(1).max(200).nullable().optional(),
  certifyingPhysicianNpi: z
    .string()
    .regex(/^\d{10}$/)
    .nullable()
    .optional(),
  terminalDxIcd10: z.string().min(3).max(12).nullable().optional(),
  terminalDxText: z.string().max(500).nullable().optional(),
  placeOfService: z
    .enum(['home', 'snf', 'assisted_living', 'inpatient', 'other'])
    .optional(),
  notes: z.string().max(2000).nullable().optional(),
  electionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  effectiveDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
export type UpdateHospiceElectionInput = z.infer<typeof UpdateHospiceElectionSchema>;

export const ActivateHospiceElectionSchema = z.object({
  /** Start first benefit period on activate (default true). */
  openBenefitPeriod: z.boolean().default(true),
  initialLoc: z.enum(HospiceLevelOfCare).default('routine'),
});
export type ActivateHospiceElectionInput = z.infer<typeof ActivateHospiceElectionSchema>;

export const RevokeHospiceElectionSchema = z.object({
  revokedAt: z.string().datetime().optional(),
  reason: z.string().min(1).max(2000),
});
export type RevokeHospiceElectionInput = z.infer<typeof RevokeHospiceElectionSchema>;

export const ChangeHospiceLocSchema = z.object({
  levelOfCare: z.enum(HospiceLevelOfCare),
  startedAt: z.string().datetime().optional(),
  reason: z.string().max(2000).optional(),
  facilityName: z.string().max(200).optional(),
});
export type ChangeHospiceLocInput = z.infer<typeof ChangeHospiceLocSchema>;

export const RequestHospiceCertSchema = z.object({
  docType: z.enum(['hospice_cert', 'hospice_recert']).default('hospice_cert'),
  physicianName: z.string().min(1).max(200).optional(),
  physicianNpi: z
    .string()
    .regex(/^\d{10}$/)
    .optional(),
  physicianEmail: z.string().email().max(320).optional(),
  title: z.string().min(1).max(200).optional(),
  /** Mark package ready (stub) so send can proceed without PDF in dev. */
  markReady: z.boolean().default(true),
});
export type RequestHospiceCertInput = z.infer<typeof RequestHospiceCertSchema>;

export const ListHospiceElectionsQuerySchema = z.object({
  status: z.enum(HospiceElectionStatus).optional(),
  patientId: z.string().uuid().optional(),
});
