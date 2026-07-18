# BAA Inventory

Track every vendor that may create, receive, maintain, or transmit ePHI.

| Vendor / Service | Purpose | ePHI? | BAA status | Env | Notes |
|------------------|---------|-------|------------|-----|-------|
| Amazon Web Services | Hosting, RDS, S3, KMS, Cognito, logs | Yes (prod) | **Required before prod** | stage/prod | Use HIPAA-eligible services only |
| MinIO (local Docker) | Local object storage stand-in | Synthetic only | N/A | dev | Do not load real PHI |
| Email provider TBD | Notifications | Possibly | Required if PHI | | Prefer no PHI in subject lines |
| SMS provider TBD | Visit reminders | Possibly | Required if PHI | Phase 4+ | Minimize PHI |
| APM / error tracking TBD | Diagnostics | Risk | BAA or disable PHI | | Scrub payloads |
| AI provider TBD | Service AI suggestions | Risk | BAA + policy | Phase 4+ | HITL only; no training on PHI without agreement |

Update this table when adding integrations.
