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

- [ ] `AUTH_PROVIDER=cognito` — `POST /v1/auth/session` exchanges Cognito ID token for app JWT
- [ ] Dev-login disabled in staging/prod (`DEV_LOGIN_DISABLED`)
- [ ] MFA for admin, compliance, break-glass (`MFA_REQUIRED_ROLES`, user `mfaRequired`)
- [ ] Cognito User Pool MFA configured; app verifies `amr` / `COGNITO_MFA_CLAIM`
- [ ] Short-lived tokens; refresh via Cognito re-auth + session exchange
- [ ] Session timeout policy for web + mobile (`SESSION_IDLE_TIMEOUT_MINUTES`)
- [ ] `NEXT_PUBLIC_AUTH_PROVIDER=cognito` on web console

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

## Notifications

- [ ] `EMAIL_PROVIDER=ses` (or BAA-covered provider) with verified `EMAIL_FROM`
- [ ] Invite emails deliver; tokens hashed at rest only
- [ ] Physician sign-link emails deliver without PHI in subject/body beyond initials + DOB year
- [ ] Resend paths tested (invite + order package)

## Security validation

- [x] Cross-tenant isolation test in CI: `pnpm --filter @hhos/db test:rls` (hhos_app + FORCE RLS)
- [ ] Cross-tenant isolation test with API tokens (Org A cannot read Org B patients)
- [ ] Audit log export for sample PHI mutation
- [ ] Pen-test / vulnerability scan findings remediated or risk-accepted
- [ ] Break-glass procedure documented and tested (no cross-tenant god-mode)

## Operational

- [ ] On-call rotation
- [ ] Monitoring / alerting (API 5xx, DB, storage) — `/health` + `/ready`
- [ ] `HHOS_ENV=staging|production` boot guards pass (RLS + Cognito + secrets)
- [ ] Support process for provider sign-link failures
- [ ] Data retention / disposal policy
- [ ] Postgres + object storage backup restore drill
