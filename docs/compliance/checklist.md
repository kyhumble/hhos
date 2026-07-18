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
