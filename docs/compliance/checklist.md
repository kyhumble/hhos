# Compliance Checklist (living)

## Before any production PHI

- [ ] AWS BAA executed  
- [ ] All subprocessors listed in BAA inventory with BAAs  
- [ ] Encryption in transit (TLS 1.2+) and at rest documented  
- [ ] Unique user IDs; MFA for privileged roles  
- [ ] Session timeout / automatic logoff  
- [ ] Audit controls on create/read/update/delete/export of ePHI  
- [ ] Consent versioning + revocation tested  
- [ ] Minimum necessary / purpose limitation enforced in API  
- [ ] Breach detection hooks + IR runbook  
- [ ] Data retention / disposal policy aligned to Medicare + state  
- [ ] Workforce training plan  
- [ ] Contingency: backups, RTO/RPO  
- [ ] Non-prod uses synthetic data only  
- [ ] Legal review of consent templates and NPP linkage  
- [ ] `AUTH_PROVIDER=cognito` (or equivalent) in production  

## Phase 0 scaffold status

- [x] Repo conventions (`AGENTS.md`)  
- [x] Synthetic seeds only  
- [x] Audit table schema  
- [x] Consent template structure with placeholder legal text  
- [ ] Full RBAC enforcement on all routes (Phase 1)  
- [ ] Field encryption helpers wired (Phase 1)  
- [ ] RLS policies applied (Phase 1)  

## Phase 2 photo pipeline (pre-pilot)

- [x] Camera-only clinical capture (no gallery source of truth) — design + mobile path  
- [x] Consent purpose `WOUND_PHOTO_CLINICAL` on capture/upload/view (`assertConsentPurpose`)  
- [x] Encrypt-before-upload (client AES-GCM + server `PHOTO_KEK` envelope)  
- [x] Private object storage; dual S3 endpoints; decrypt-proxy view  
- [x] Device register required; revoke blocks photo ops  
- [x] Post-revoke view policy **K16** (deny clinical; compliance break-glass + reason)  
- [x] Billing has no `wound_photo:read`; content never accepts `document:read`  
- [x] Threat model updated for photo pipeline (`docs/compliance/threat-model-v0.md`)  
- [x] KPI definitions (ids only) (`docs/architecture/phase-2-kpis.md`)  
- [ ] Counsel / Compliance Officer sign-off on consent template body  
- [ ] AWS BAA + prod KMS/CMK for photo KEK  
- [ ] Pen test / security review including mobile lost-device playbook  
- [ ] Pilot with synthetic-only → limited real PHI only after BAAs  

