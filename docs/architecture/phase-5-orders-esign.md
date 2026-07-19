# HHOS Phase 5 — Orders, 485 / Plan of Care & Physician E-Sign

## Goal

Close the largest home health billing hangup: **unsigned physician orders and CMS-485 / Plan of Care**. Staff create a package, attach the PDF, send a secure link to the provider, capture signature (or record wet-ink), and update episode readiness.

Scope: **home health + hospice form types**. No longevity. No claim submission (Phase 7).

## Principles

1. **HITL only** — system never fabricates a physician signature.  
2. **Org-scoped** — every row has `org_id`.  
3. **Audit** — create, send, view, sign, reject, void.  
4. **Token security** — raw magic link token shown once; store SHA-256 only.  
5. **Feature-flagged** — `FEATURE_ORDERS_ESIGN` (+ org `settings.features.ordersEsign`).  
6. **Minimal PHI on public sign page** — org name, doc type, physician name, patient initials + DOB year only (not full chart).

## Domain

| Entity | Purpose |
|--------|---------|
| `order_packages` | Unit of work: one 485, order, F2F, hospice cert, etc. |
| `clinical_documents_meta` | PDF object metadata (existing table) |
| `signature_requests` | Outbound sign request + status timeline |

### Doc types

`plan_of_care_485`, `physician_order`, `verbal_order`, `f2f_encounter`, `hospice_cert`, `hospice_recert`, `other`

### Package lifecycle

`draft` → `ready` (PDF attached) → `sent` → (`viewed`) → `signed` | `rejected` | `expired` | `void`

On **signed** for `plan_of_care_485` / `physician_order` / `verbal_order`: update episode `pocStatus` / `ordersStatus` when applicable.

## API (v1)

| Method | Path | Auth |
|--------|------|------|
| POST | `/order-packages` | order:write |
| GET | `/order-packages` | order:read |
| GET | `/order-packages/:id` | order:read |
| POST | `/order-packages/:id/upload` | order:write (presign PUT) |
| POST | `/order-packages/:id/complete-upload` | order:write |
| POST | `/order-packages/:id/send` | order:send |
| POST | `/order-packages/:id/void` | order:send |
| POST | `/order-packages/:id/record-external-sign` | order:send (wet-ink / external) |
| GET | `/worklists/orders-signatures` | order:read |
| GET | `/sign/:token` | public (limited) |
| POST | `/sign/:token` | public (provider e-sign) |

## Permissions

`order:read`, `order:write`, `order:send`

## Out of scope (later)

- Real email/SMS delivery (token returned for staff copy in MVP)  
- DocuSign / Adobe Sign integration  
- Full CMS-485 structured form builder  
- Claim / EDI export (Phase 7)  
- Postgres RLS (Phase 8)
