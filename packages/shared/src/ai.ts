import { z } from 'zod';

/**
 * Provenance for any AI-generated content.
 * Supports audit, explainability, and model governance.
 * Never put PHI in factors/evidence when logging.
 */
export const AIProvenanceSchema = z.object({
  modelVersion: z.string(),
  confidence: z.number().min(0).max(1),
  factors: z.array(z.string()).optional(),
  evidence: z.array(z.string()).optional(),
  inputHash: z.string().optional(), // hash of inputs for audit without PHI
  generatedAt: z.string().datetime(),
  requestId: z.string().optional(),
});

export type AIProvenance = z.infer<typeof AIProvenanceSchema>;

/**
 * Single AI suggestion that a clinician must accept, edit, or reject.
 * Core primitive for HITL ambient documentation, OASIS assists, coding, etc.
 */
export const AISuggestionSchema = z.object({
  id: z.string().uuid(),
  type: z.enum([
    'oasis_item',
    'note_section',
    'care_plan',
    'coding',
    'risk_flag',
    'schedule',
    'other',
  ]),
  targetPath: z.string().optional(), // e.g. "oasis.M1800" or "note.assessment"
  title: z.string(),
  content: z.string(), // suggested text or value
  structured: z.record(z.unknown()).optional(),
  provenance: AIProvenanceSchema,
  status: z.enum(['pending', 'accepted', 'edited', 'rejected']).default('pending'),
  humanEdit: z.string().optional(),
  actedAt: z.string().datetime().optional(),
  actedBy: z.string().uuid().optional(),
});

export type AISuggestion = z.infer<typeof AISuggestionSchema>;

/**
 * Full ambient draft for a visit (sections + list of suggestions).
 */
export const AmbientDraftSchema = z.object({
  visitId: z.string().uuid(),
  sections: z.record(z.string(), z.string()), // e.g. { assessment: "...", plan: "..." }
  suggestions: z.array(AISuggestionSchema),
  provenance: AIProvenanceSchema,
});

export type AmbientDraft = z.infer<typeof AmbientDraftSchema>;

/**
 * Predictive risk score with band and recommended actions.
 */
export const RiskScoreSchema = z.object({
  patientId: z.string().uuid(),
  episodeId: z.string().uuid().optional(),
  scoreType: z.enum([
    'hospitalization_30d',
    'fall',
    'lupa',
    'functional_decline',
    'other',
  ]),
  value: z.number(),
  band: z.enum(['low', 'moderate', 'high', 'critical']),
  provenance: AIProvenanceSchema,
  recommendedActions: z.array(z.string()).optional(),
});

export type RiskScore = z.infer<typeof RiskScoreSchema>;
