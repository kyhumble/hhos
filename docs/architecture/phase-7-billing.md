# HHOS Phase 7 — Billing Readiness & Claim Export Prep

## Goal

Tell agencies **what still blocks clean billing**, then package claim-ready episodes into an **export artifact** for external clearinghouse / billing staff. No live EDI submission to payers in this phase.

Scope: home health (RAP/final readiness) + hospice (NOE + claim readiness). No longevity.

## Principles

1. **HITL** — system never marks a claim “paid” or auto-submits to CMS.  
2. **Signatures matter** — unsigned 485/orders/cert packages block readiness (Phase 5).  
3. **Org-scoped** exports and claim rows.  
4. **Feature flag** — `FEATURE_BILLING` + org `settings.features.billing`.  
5. **Export format** — versioned JSON (`hhos-claim-export-v1`); X12 837 later.

## Domain

| Entity | Purpose |
|--------|---------|
| `billing_claim_packages` | One intended claim (RAP, final, NOE, hospice claim) |
| Readiness engine | Pure function of episode + related rows → gaps + ready flag |

### Claim types

`hh_rap` | `hh_final` | `hospice_noe` | `hospice_claim` | `other`

### Lifecycle

`draft` → `ready` (all hard gaps cleared) → `exported` → optional `submitted_external` | `void`  
`blocked` when created/refreshed with hard gaps.

## Hard gaps (examples)

**Home health / wound**

- Missing primary DX  
- Orders not signed  
- POC/485 not signed (hh_rap / hh_final)  
- No active/verified coverage when org requires it  

**Hospice**

- No active election  
- Cert package missing or unsigned  
- Missing terminal DX  

Soft gaps (warnings only): F2F incomplete, OASIS not locked, intake incomplete.

## API

| Method | Path |
|--------|------|
| GET | `/billing/readiness/:episodeId` |
| GET | `/worklists/billing` |
| POST | `/billing/claims` |
| GET | `/billing/claims` |
| GET | `/billing/claims/:id` |
| POST | `/billing/claims/:id/refresh` |
| POST | `/billing/claims/:id/export` |
| POST | `/billing/claims/:id/mark-submitted` |
| POST | `/billing/claims/:id/void` |

## Permissions

`billing:read`, `billing:write`, `billing:export`
