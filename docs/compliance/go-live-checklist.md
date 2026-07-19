# HHOS Go-Live Checklist (Home Health + Hospice)

**No real PHI until every applicable box is owned and checked.** Synthetic data only in non-prod.

## Legal / BAAs

- [ ] Covered entity / BA agreements signed for hosting, email, SMS, e-sign, AI (if any)
- [ ] Update `docs/compliance/baa-inventory.md` with prod vendors
- [ ] Notice of Privacy Practices / consent templates counsel-approved (remove NOT LEGAL FINAL)
- [ ] Incident response contacts documented

## Infrastructure

- [ ] AWS (or other) account under BAA where ePHI will land
- [ ] Postgres encrypted at rest; network isolated (no public DB)
- [ ] Object storage private; no public ACLs; TLS only
- [ ] Secrets in vault/SSM — never in git
- [ ] `FEATURE_RLS=true` in staging and production
- [ ] Separate `PHOTO_KEK` / KMS from field encryption key
- [ ] Backups encrypted + restore drill completed

## Auth

- [ ] `AUTH_PROVIDER=cognito` (or equivalent IdP) — local JWT disabled
- [ ] MFA for admin, compliance, break-glass
- [ ] Short-lived tokens; refresh policy approved
- [ ] Session timeout policy for web + mobile

## Application flags (per environment)

| Flag | Prod guidance |
|------|----------------|
| `FEATURE_RLS` | **true** |
| `FEATURE_ORDERS_ESIGN` | true when using 485/orders |
| `FEATURE_HOSPICE` | true if agency does hospice |
| `FEATURE_BILLING` | true for readiness/export |
| `FEATURE_OASIS` | true when item set compliance-approved |
| `FEATURE_WOUND_PHOTOS` | true only after photo BAAs + KEK |
| `FEATURE_SERVICE_AI` | true only with HITL policy + BAA if LLM |

## Clinical / billing readiness

- [ ] 485 / orders e-sign path validated with real physician workflow (test org)
- [ ] Hospice election + cert path validated if applicable
- [ ] Billing export reviewed by billing lead (JSON handoff process)
- [ ] No auto-submit of claims or auto-signature in prod config

## Security validation

- [ ] Cross-tenant isolation test: Org A token cannot read Org B patients (RLS + API)
- [ ] Audit log export for sample PHI mutation
- [ ] Pen-test / vulnerability scan findings remediated or risk-accepted
- [ ] Break-glass procedure documented and tested

## Operational

- [ ] On-call rotation
- [ ] Monitoring / alerting (API 5xx, DB, storage)
- [ ] Support process for provider sign-link failures
- [ ] Data retention / disposal policy
