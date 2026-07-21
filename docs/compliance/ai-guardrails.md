# AI Guardrails (Lumina / HHOS)

AI features are a core differentiator for the platform. They must remain safe, auditable, and survey-ready.

## Absolute rules (from AGENTS.md + this document)

1. **Human-in-the-loop (HITL) only.**  
   AI never auto-finalizes clinical notes, OASIS items, care plans, coding, claims, or schedule assignments. Every suggestion requires explicit clinician Accept / Edit / Reject.

2. **Full provenance and audit.**  
   Every generation and every human decision is logged via the existing `AuditService`.

   Recommended `action` values:
   - `ai.suggestion.generated`
   - `ai.suggestion.accepted`
   - `ai.suggestion.edited`
   - `ai.suggestion.rejected`
   - `ai.risk_score.surfaced`
   - `ai.ambient_draft.generated`

   Recommended fields in `after` / metadata (ids only, no PHI content):
   - `suggestionId` or `draftId`
   - `type` (oasis_item | note_section | risk_flag | …)
   - `confidence`
   - `modelVersion`
   - `targetPath` or `targetResourceId`
   - `status` / human decision
   - `requestId`

3. **No PHI in logs.**  
   Factors, evidence, and suggestion content must never appear in application logs. Use ids + hashes. Full content lives only in the database under org-scoped RLS.

4. **Feature flags.**  
   Gate all AI endpoints and UI behind `FEATURE_AI_SUGGESTIONS` (or reuse / extend `FEATURE_SERVICE_AI`). Support per-org disable via org settings.

5. **Explainability.**  
   UI must surface confidence and a “Why?” view (factors / evidence). This supports clinician trust and survey readiness.

6. **Consent for ambient.**  
   Ambient audio capture (future) requires a dedicated consent purpose (e.g. `AMBIENT_DOCUMENTATION`), clear patient notice, and preferably ephemeral processing. Pure structured / RPM / prior-data suggestions may use existing clinical consents; document the decision.

7. **Model governance.**  
   - Track `modelVersion` on every suggestion.
   - Prefer de-identified or synthetic data for any training / evaluation.
   - Continuous evaluation for accuracy, bias, and clinical safety.
   - Human feedback (accept / edit / reject) is captured for improvement loops.

8. **Security.**  
   AI endpoints inherit existing RBAC, caseload scoping, and RLS. Suggestions for a patient are only visible to authorized users on that caseload/org.

## Implementation checklist for new AI features

- [ ] Types live in `@hhos/shared` (`AISuggestion`, `AIProvenance`, etc.)
- [ ] Feature-flagged
- [ ] HITL enforced in UI and API (no auto-write of clinical facts)
- [ ] Audit events on generate + human decision
- [ ] Confidence + factors shown in UI
- [ ] No PHI in logs or non-prod fixtures
- [ ] Permission annotations on routes
- [ ] Documented in this file or threat model if risk profile changes

## Related

- `packages/shared/src/ai.ts` — canonical types
- `docs/architecture/phase-4-service-ai-routing.md` — existing HITL routing plans
- `AGENTS.md` — core rules
- Existing `AuditService.write` / `writeFromUser`
