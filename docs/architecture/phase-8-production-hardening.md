# HHOS Phase 8 — Production Hardening

## Goal

Harden multi-tenant isolation and document go-live gates **before real PHI**. Home health + hospice only (no longevity).

## Postgres RLS

Row Level Security is enabled with **FORCE** on org-scoped PHI/ops tables.

Session GUC variables (transaction-local):

| Setting | Meaning |
|---------|---------|
| `app.rls_enforced` | `on` activates isolation for the transaction; unset = open (local dogfood) |
| `app.current_org_id` | UUID of tenant for this request |
| `app.rls_bypass` | `on` allows cross-org (public routes, seed) |

Policies allow a row when:

- `app.rls_enforced` is not `on` (default open), **or**
- `app.rls_bypass = 'on'`, **or**
- `org_id = app.current_org_id::uuid`

### API wiring

When `FEATURE_RLS=true`:

1. Each HTTP request runs inside a **DB transaction** with `app.rls_enforced=on`.
2. Authenticated: set `app.current_org_id` from JWT `orgId`, `app.rls_bypass=off`.
3. Unauthenticated (health, create org, dev-login, provider sign): `app.rls_bypass=on`.
4. Request-scoped Drizzle handle is bound via AsyncLocalStorage so pool reuse cannot leak org context across concurrent requests.

When `FEATURE_RLS=false` (local default): interceptor is idle; `rls_enforced` stays off so FORCE RLS does not block dogfood. **Staging/prod must set `FEATURE_RLS=true`.**

### Database roles

| Role | Purpose |
|------|---------|
| `hhos` (local docker default) | Often superuser — **ignores RLS** (fine for migrate/seed) |
| `hhos_app` | App runtime role created by migration 0008 — **subject to RLS** |

Production / RLS staging:

```bash
# migrate + seed as owner
DATABASE_URL=postgresql://hhos:…@…/hhos pnpm --filter @hhos/db migrate

# API runtime as non-superuser
DATABASE_URL=postgresql://hhos_app:hhos_app_dev@…/hhos
FEATURE_RLS=true
```

Local password for `hhos_app` defaults to `hhos_app_dev` (override with `DATABASE_APP_PASSWORD`).

### Migrations / seed

Run as owner/superuser. Seed sets `app.rls_bypass=on` for the session (still needed if using non-superuser for seed).

## Auth production gate

- `AUTH_PROVIDER=cognito` required in production (local JWT is dev-only).
- MFA for compliance / break-glass roles (org setting + Cognito).

## Go-live checklist (summary)

See `docs/compliance/go-live-checklist.md`.

## Out of scope (still later)

- Live EDI 837 submission  
- Per-org KMS CMK for photo KEK  
- Platform super-admin console  
- Full HIPAA risk analysis sign-off (customer-specific)
