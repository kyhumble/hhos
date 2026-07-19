# BAA Inventory

Track every vendor that may create, receive, maintain, or transmit ePHI.

| Vendor / Service | Purpose | ePHI? | BAA status | Env | Notes |
|------------------|---------|-------|------------|-----|-------|
| Amazon Web Services | Hosting, RDS, **S3**, **KMS**, Cognito, logs | Yes (prod) | **Required before prod** | stage/prod | HIPAA-eligible services only; photo objects private + envelope encrypted; KMS CMK for `PHOTO_KEK` rotation path |
| MinIO (local Docker) | Local object storage stand-in for wound-photo ciphertext | **Synthetic only** | N/A | dev | Do not load real PHI; private bucket; not a prod subprocessor |
| Mobile OS / device OEM | Device encryption, Secure Store | Risk on lost device | N/A (device) | field | MDM / OS encryption policy; device revoke in API |
| Expo / EAS (build) | Mobile build pipeline | No PHI if CI uses synthetic | Review if logs capture screens | build | Never embed prod keys in client binaries |
| Email provider TBD | Notifications | Possibly | Required if PHI | | Prefer no PHI in subject lines |
| SMS provider TBD | Visit reminders | Possibly | Required if PHI | Phase 4+ | Minimize PHI |
| APM / error tracking TBD | Diagnostics | Risk | BAA or disable PHI | | Scrub payloads; **never** log DEKs, photo bytes, geo |
| AI provider TBD | Service AI suggestions | Risk | BAA + policy | Phase 4+ | HITL only; no training on PHI without agreement |

## Phase 2 photo-specific notes

- Clinical images are **ePHI**. Prod path: private S3 + KMS (or org-approved KEK custody) under AWS BAA.  
- Local MinIO is for **synthetic** dogfood only; treat any accidental real photo as an incident.  
- Presigned **PUT** is short-lived; clinical **view** is decrypt-proxy only (no long-lived public GET).  
- Third-party camera/analytics SDKs: prefer none; inventory before adding.  
- Update this table when adding CDN, thumbnail pipelines, or external review tools.

Update this table when adding integrations.
