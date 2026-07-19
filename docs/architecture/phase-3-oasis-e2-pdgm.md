# HHOS Phase 3 — OASIS-E2 Assessments & PDGM Optimization

| Field | Value |
|-------|--------|
| **Status** | Approved for implementation (v1 framework) |
| **Phase** | 3 (builds on Phase 0–2) |
| **Date** | 2026-07-19 |
| **CMS note** | Item definitions must be re-validated against official OASIS-E2 materials before production lock. This version ships a **PDGM-critical subset + extensible item library**, not a complete CMS dump. |

## Goals

1. Versioned **OASIS-E2 item library** (`itemSetVersion = oasis-e2-2026.04-subset-v1`)
2. Episode-scoped assessments (SOC first; other timepoints scaffolded)
3. Progressive capture API + web UI; clinical lead **review / lock** queue
4. **Advisory** PDGM flags: missing primary dx, thin functional, skin gaps, LUPA risk
5. Documentation gap checklist pre-lock
6. Human-in-the-loop: system never auto-finalizes clinical/billing decisions

## Non-goals

- Full CMS item XML import / iQIES export (Phase 3.1)
- Claim submission / HIPPS production grouper (Phase 5)
- AI documentation suggestions (Phase 4)
- Mobile full offline OASIS capture (stretch; web + API first)

## Data model

- `oasis_assessments` — episode, timepoint, status (`draft` → `in_review` → `locked` | `void`)
- `oasis_item_responses` — item_id, value_json, answered_by, answered_at
- Flags computed on validate/submit (stored snapshot on assessment `flags_json`, `gaps_json`, `pdgm_hint_json`)

## Permissions

| Code | Roles |
|------|--------|
| `oasis:read` | field_rn, intake, clinical_lead, billing (limited), compliance, admin |
| `oasis:write` | field_rn, clinical_lead, admin |
| `oasis:submit` | field_rn, clinical_lead, admin |
| `oasis:review` | clinical_lead, admin |
| `oasis:lock` | clinical_lead, admin |

## LUPA advisory (MVP)

- Configurable threshold default **4** visits per 30-day period (simplified; not full HIPPS table)
- Flag `LUPA_RISK` when planned/completed skilled visits in period &lt; threshold
- Always labeled **advisory — not a payment determination**

## Feature flag

`FEATURE_OASIS=true` (default false in prod; true local via `.env.example` comment)

## Implementation order (this PR / commit)

Single integrated vertical slice on `main`: shared → db → api → web shell → docs.
