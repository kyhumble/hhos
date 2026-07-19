# HHOS Phase 4 — Service AI Routing, Scheduling & Field Ops

| Field | Value |
|-------|--------|
| **Status** | Implemented (v1) |
| **Phase** | 4 |
| **Date** | 2026-07-19 |

## Goals

1. Clinician profiles: skills, languages, home base (for routing)
2. **Route / assignment suggestions** with explainability scores
3. **Human-in-the-loop only** — accept / reject with reason codes; never auto-assign clinical caseload
4. Visit / field task board (beyond photo clinical_tasks): reassessment, SOC visit, follow-up
5. Hospitalization alert intake hooks (manual + webhook-ready)
6. Feature-flagged: `FEATURE_SERVICE_AI`

## Non-goals

- Full TSP multi-day optimization / Google OR-Tools (v1 uses transparent scoring)
- Autonomous LLM clinical decisions
- Live maps vendor without BAA (addresses only; geocode optional stub)
- Production Cognito

## Service AI (HITL)

Suggestions produced by deterministic scorer (geography/skills/language/caseload). Optional future LLM explainer behind same accept/reject API. All decisions audited.

## Permissions

- `routing:read`, `routing:suggest`, `routing:decide`
- `visit_task:read`, `visit_task:write`
- `alert:read`, `alert:write`
