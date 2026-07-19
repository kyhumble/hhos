# HHOS Multi-Tenant Model

## Strategy

**Shared PostgreSQL + row-level `org_id` isolation** (B2B SaaS).

Each home health agency is an `organizations` row. Users, patients, episodes, photos, OASIS, routing, and audit events all carry `org_id`. JWT claims include `orgId`; API services filter by `user.orgId`.

## Tenant lifecycle (implemented)

| Flow | Endpoint | Notes |
|------|----------|--------|
| Create org | `POST /v1/orgs` | Public bootstrap: org + slug + default roles + admin user + JWT |
| Read / update settings | `GET|PATCH /v1/orgs/me` | Settings include SOC hours, photo thresholds, **feature flags** |
| List members | `GET /v1/orgs/me/members` | Requires `user:admin` |
| Invite | `POST /v1/orgs/me/invites` | Creates `invited` user + hashed token (email provider TBD) |
| Accept invite | `POST /v1/invites/accept` | Activates user + JWT |
| Dev login | `POST /v1/auth/dev-login` | `{ email, orgId? }` — multi-org emails return `ORG_SELECTION_REQUIRED` |

## Feature flags

1. **Platform env** (`FEATURE_WOUND_PHOTOS`, `FEATURE_OASIS`, `FEATURE_SERVICE_AI`) — hard kill switch for the deployment.  
2. **Org settings** `settings.features.{woundPhotos,oasis,serviceAi}` — per-tenant disable when platform is on.

## Isolation checklist (ongoing)

- [x] `org_id` on domain tables  
- [x] Service-layer org filters  
- [x] Object keys under `org/{orgId}/...` (photos)  
- [x] Org create / invite / settings  
- [ ] Postgres **RLS** policies (`app.current_org_id`) — before real PHI  
- [ ] Per-org KMS CMK for photo KEK  
- [ ] Platform super-admin (cross-tenant support) separate from agency admin  

## Demo

- Seed org slug: `demo-agency`  
- Seed admin: `admin@demo.local`  
- Web: `/onboard`, `/admin`, `/invite`, multi-org aware `/login`
