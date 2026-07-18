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

Detailed Phase 0/1 design (ERD, consent engine, OpenAPI) lives in the session plan document approved prior to scaffold.
