# HHOS Architecture Overview

## Components

| Component | Responsibility |
|-----------|----------------|
| Mobile field app | Offline-capable RN app for visits, consents, wound photos (Phase 2) |
| Web console | Intake, worklists, admin, compliance, billing prep (later) |
| NestJS API | AuthZ, validation, domain logic, audit hooks |
| PostgreSQL | System of record for structured PHI |
| Object storage | Encrypted documents/photos (MinIO local; S3+KMS prod) |
| Audit service | Append-only event stream |

## Security layers

1. Network isolation (prod VPC)  
2. TLS 1.2+ in transit  
3. MFA / short-lived tokens  
4. RBAC + caseload scope + RLS  
5. AES-256 at rest / field encryption / KMS  
6. Append-only audit + WORM export (later)  
7. BAA inventory + incident response  

## Phase 0 defaults

- Single organization (row-level `org_id` ready for multi-tenant)  
- Local JWT auth stub; Cognito for production  
- SOC due window: 48 hours (configurable)  
- Photo geotag: disabled by default  

## Related design

| Doc | Scope |
|-----|--------|
| Session plan (pre-scaffold) | Phase 0/1 ERD, consent engine, OpenAPI sketch |
| **[Phase 2 — Secure wound photos](./phase-2-secure-wound-photos.md)** | Camera-only capture, envelope crypto, offline outbox, dual S3, consent gates (K16), devices, annotations, clinical tasks |
| **[Phase 2 KPIs](./phase-2-kpis.md)** | Operational metrics SQL (ids only — no PHI columns) |
| `docs/compliance/threat-model-v0.md` | Baseline + photo pipeline threats |
| `docs/domain/consent-purposes.md` | Purpose codes including `WOUND_PHOTO_CLINICAL` |

### Phase 2 at a glance

- **Mobile (prebuild / dev client):** app camera → AES-GCM encrypt → outbox → sync (register device → initiate → wrap-dek → presigned PUT → complete → wipe local secrets).  
- **API:** caseload + `assertConsentPurpose` + `wound_photo:*` permissions; decrypt-proxy view only; orphan GC in-process.  
- **Storage:** private bucket; `S3_ENDPOINT` (internal) vs `S3_PUBLIC_ENDPOINT` (presign Host).  
- **Web:** episode metadata gallery + on-demand `/content`; clinical task queue.  

Master flag: `FEATURE_WOUND_PHOTOS`. Photo KEK: `PHOTO_KEK` (never reuse `FIELD_ENCRYPTION_KEY`).
