# Threat Model v0 (Phase 0)

## Assets

- Patient demographics, coverage, clinical history  
- Consent records and signature artifacts  
- Future: wound photographs, OASIS assessments  
- Credentials and session tokens  
- Audit logs (integrity)  

## Actors

- Field RN, intake coordinator, clinical lead, billing, compliance, admin  
- External: referrers, payers (later), attackers, lost/stolen devices  

## Top threats (MVP horizon)

1. **Unauthorized access to patient records** — mitigate with RBAC, caseload scope, MFA  
2. **Tampering with consents or audit** — append-only audit; frozen template hashes  
3. **Data exfiltration via logs/APM** — no PHI logging; scrubbers  
4. **Insecure object storage** — private buckets; presigned short URLs; no public ACL  
5. **Lost mobile device** — device encryption; remote revoke (Phase 2); short tokens  
6. **Insider misuse** — audit; break-glass reason codes; least privilege  

## Out of scope for v0 deep dive

- Full STRIDE per component (expand Phase 1)  
- Penetration test findings (pre-prod gate)  
