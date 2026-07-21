# Recommended AI Audit Actions

Use these string values for the `action` field on `AuditService.write` / `writeFromUser` when implementing Lumina AI features.

| Action | When to emit | Typical resourceType | Notes |
|--------|--------------|----------------------|-------|
| `ai.suggestion.generated` | AI produces one or more suggestions | `AISuggestion` or target (e.g. `Visit`, `OasisAssessment`) | Include modelVersion, confidence band, suggestion count. No content. |
| `ai.suggestion.accepted` | Clinician accepts suggestion as-is | same | Link suggestionId + target |
| `ai.suggestion.edited` | Clinician accepts with modifications | same | Optionally store edit summary (redacted) |
| `ai.suggestion.rejected` | Clinician rejects | same | |
| `ai.ambient_draft.generated` | Full ambient draft created for a visit | `Visit` | |
| `ai.risk_score.surfaced` | Risk score shown to clinician | `Patient` / `Episode` | scoreType + band only |

Always include `orgId`, `actorUserId`, `requestId`, and relevant `patientId` / `episodeId` / `resourceId`.

See `docs/compliance/ai-guardrails.md` for full policy.
