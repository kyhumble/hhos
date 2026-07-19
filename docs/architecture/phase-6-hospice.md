# HHOS Phase 6 — Hospice Clinical Core

## Goal

Support **hospice agencies** (same multi-tenant OS as home health / wound): election of hospice benefit, benefit periods, level-of-care (LOC) changes, and physician certification packages that reuse **Phase 5 e-sign**.

**Out of scope:** longevity, full NOE/NOT claims (Phase 7), HIS / CAHPS export.

## Principles

1. Org-scoped (`org_id`) everywhere.  
2. Hospice episodes use `care_type = hospice`.  
3. Cert / recert signatures go through `order_packages` (`hospice_cert`, `hospice_recert`) + magic-link e-sign.  
4. HITL — system never auto-certifies prognosis or auto-signs.  
5. Feature flag: `FEATURE_HOSPICE` + org `settings.features.hospice`.

## Domain

| Entity | Purpose |
|--------|---------|
| `hospice_elections` | Medicare (or commercial) election of hospice benefit |
| `hospice_benefit_periods` | 90/90/60… periods under an election |
| `hospice_loc_stays` | Routine, continuous, respite, GIP intervals |

### Election lifecycle

`draft` → `active` (benefit elected) → `revoked` | `discharged` | `transferred`

Activation does **not** invent a physician signature; staff should request cert package via Phase 5.

### Levels of care

`routine` | `continuous` | `respite` | `gip`

Only one open LOC stay per election at a time (end previous when starting new).

## API

| Method | Path | Notes |
|--------|------|--------|
| POST | `/hospice/elections` | Create for patient + episode |
| GET | `/hospice/elections` | List / filter |
| GET | `/hospice/elections/:id` | Detail + periods + LOC |
| PATCH | `/hospice/elections/:id` | Update draft/active fields |
| POST | `/hospice/elections/:id/activate` | Start benefit + period 1 |
| POST | `/hospice/elections/:id/revoke` | Revoke election |
| POST | `/hospice/elections/:id/loc` | Change level of care |
| POST | `/hospice/elections/:id/request-cert` | Create Phase 5 order package |
| GET | `/worklists/hospice` | Active / cert-gap worklist |

## Permissions

`hospice:read`, `hospice:write`
