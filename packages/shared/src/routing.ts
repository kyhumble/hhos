import { z } from 'zod';
import {
  ClinicianSkill,
  RouteDecisionReason,
  RouteSuggestionStatus,
  VisitTaskStatus,
  VisitTaskType,
  HospitalizationAlertStatus,
} from './enums';

export const UpsertClinicianProfileSchema = z.object({
  userId: z.string().uuid(),
  skills: z.array(z.enum(ClinicianSkill)).default([]),
  languages: z.array(z.string().min(2).max(10)).default(['en']),
  homeBaseCity: z.string().max(100).optional(),
  homeBaseState: z.string().length(2).optional(),
  homeBasePostal: z.string().max(15).optional(),
  maxDailyVisits: z.number().int().min(1).max(20).default(6),
  activeForRouting: z.boolean().default(true),
});

export type UpsertClinicianProfileInput = z.infer<typeof UpsertClinicianProfileSchema>;

export const GenerateRouteSuggestionsSchema = z.object({
  episodeId: z.string().uuid(),
  requiredSkills: z.array(z.enum(ClinicianSkill)).default(['wound_care']),
  limit: z.number().int().min(1).max(10).default(5),
});

export type GenerateRouteSuggestionsInput = z.infer<typeof GenerateRouteSuggestionsSchema>;

export const DecideRouteSuggestionSchema = z.object({
  decision: z.enum(['accepted', 'rejected']),
  reasonCode: z.enum(RouteDecisionReason),
  note: z.string().max(2000).optional(),
  /** When accepting, assign as primary_rn on care team */
  assignToCareTeam: z.boolean().default(true),
});

export type DecideRouteSuggestionInput = z.infer<typeof DecideRouteSuggestionSchema>;

export const CreateVisitTaskSchema = z.object({
  episodeId: z.string().uuid(),
  patientId: z.string().uuid().optional(),
  taskType: z.enum(VisitTaskType),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  dueAt: z.string().datetime().optional(),
  scheduledAt: z.string().datetime().optional(),
  assigneeUserId: z.string().uuid().optional(),
  priority: z.enum(['routine', 'urgent']).default('routine'),
});

export type CreateVisitTaskInput = z.infer<typeof CreateVisitTaskSchema>;

export const UpdateVisitTaskSchema = z.object({
  status: z.enum(VisitTaskStatus).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  assigneeUserId: z.string().uuid().nullable().optional(),
  priority: z.enum(['routine', 'urgent']).optional(),
  completionNote: z.string().max(2000).optional(),
});

export type UpdateVisitTaskInput = z.infer<typeof UpdateVisitTaskSchema>;

export const CreateHospitalizationAlertSchema = z.object({
  patientId: z.string().uuid(),
  episodeId: z.string().uuid().optional(),
  facilityName: z.string().min(1).max(200),
  admittedAt: z.string().datetime().optional(),
  source: z.enum(['manual', 'webhook', 'payer', 'family']).default('manual'),
  notes: z.string().max(2000).optional(),
  externalRef: z.string().max(100).optional(),
});

export type CreateHospitalizationAlertInput = z.infer<
  typeof CreateHospitalizationAlertSchema
>;

export const UpdateHospitalizationAlertSchema = z.object({
  status: z.enum(HospitalizationAlertStatus),
  notes: z.string().max(2000).optional(),
});

export type UpdateHospitalizationAlertInput = z.infer<
  typeof UpdateHospitalizationAlertSchema
>;

/** Explainable score breakdown for a suggestion candidate. */
export type RouteScoreBreakdown = {
  total: number;
  geography: number;
  skills: number;
  language: number;
  caseload: number;
  explanations: string[];
};
