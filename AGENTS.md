# HHOS — Agent & Developer Conventions

This repository is a **HIPAA-by-design Home Health Operating System** for mobile wound care.
Compliance is non-negotiable. Treat every change as potentially surveyor-visible.

## Stack

| Layer | Tech |
|-------|------|
| Monorepo | pnpm + Turborepo |
| API | NestJS + TypeScript + Zod validation |
| Web | Next.js (App Router) + TypeScript + Tailwind |
| Mobile | Expo (React Native) + TypeScript |
| DB | PostgreSQL 16 + Drizzle ORM |
| Local deps | Docker Compose (Postgres, Redis, MinIO) |
| Cloud target | AWS (BAA required before production PHI) |

## Absolute rules

1. **No real ePHI in non-prod.** Seeds, fixtures, logs, screenshots, and tickets use synthetic data only.
2. **No PHI in logs.** Log `requestId`, resource ids, actor ids — never names, DOB, MRN, addresses, diagnosis text, or photo payloads.
3. **Consent before clinical wound photos.** Phase 2 capture must call purpose check `WOUND_PHOTO_CLINICAL`. Never allow gallery pick as clinical source of truth.
4. **AI is human-in-the-loop.** Suggestions only; never auto-finalize clinical or billing-critical decisions.
5. **Every PHI mutation is audited** (who, what, when, where, before/after redacted, request id).
6. **Least privilege.** Annotate routes with permissions; field RN is caseload-scoped.
7. **Field-level encrypt** SSN and insurance member ids at rest.
8. **Prod auth gate:** `AUTH_PROVIDER=cognito` in production; local JWT is dev-only.
9. **Third parties touching ePHI require BAAs.** Document in `docs/compliance/baa-inventory.md`.
10. **Consent template body text is legal-sensitive.** Placeholder text is marked NOT LEGAL FINAL until Compliance Officer / counsel approval.

## Coding standards

- TypeScript `strict`; avoid `any` on API boundaries and PHI models.
- Shared contracts live in `@hhos/shared` (Zod schemas, enums, permissions).
- DB schema and migrations live in `@hhos/db` only — no ad-hoc SQL in apps without migration.
- Prefer small domain modules under `apps/api/src/*` matching Phase 1 domains.
- Idempotency keys on referral create and consent capture.
- Soft-delete clinical records (`deleted_at`); never silent hard-delete of audit/consent history.

## SOC & clinical policy defaults (configurable)

- Default SOC due window: **48 hours** from `referral.received_at` (`SOC_DUE_HOURS`). Production value requires compliance approval.
- Photo geotag: **off by default** (`PHOTO_GEOTAG_ENABLED=false`).

## PR checklist

- [ ] Typecheck / lint / tests pass
- [ ] Migration included if schema changed
- [ ] Permission annotations on new routes
- [ ] Audit events for PHI mutations / sensitive reads
- [ ] No PHI in logs or fixtures
- [ ] If consent, SOC, or auth changed: note compliance impact in PR body
- [ ] OpenAPI / shared Zod updated when API contract changes

## Phase map (do not scope-creep MVP)

- **Phase 0:** Bootstrap (this scaffold)
- **Phase 1:** Intake, consents, SOC tracking, RBAC/audit
- **Phase 2:** Secure wound photos (offline, encrypt, sync)
- **Phase 3:** OASIS-E2 subset + PDGM/LUPA advisory (FEATURE_OASIS); never auto-lock billing
- **Phase 4:** Service AI routing HITL only (FEATURE_SERVICE_AI); never auto-assign without accept
- **Phase 5+:** Billing, portals, longevity modules

## Security notes for agents

- Never commit `.env`, keys, or patient exports.
- Never disable TLS checks "to make it work" against real endpoints.
- Never implement gallery-based clinical photo import.
- Never log full request bodies on patient/consent routes.
