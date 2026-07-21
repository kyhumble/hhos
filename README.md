# AetherCare Intelligence Platform (HHOS)

**AI-native, compliance-first operating system for home health agencies.**

This repository (technical name **HHOS**) is the living implementation of the **AetherCare Intelligence Platform** — a unified system purpose-built to attack the five highest-impact operational and financial pain points in home health:

1. **Documentation Burden (“OASIS Tax”)** — Guided, pre-populated, voice-capable OASIS-E2 capture that targets 40–60 min SOC assessments with high first-pass accuracy.
2. **PDGM Coding & Case-Mix Accuracy (CY 2026 Ready)** — Real-time advisory diagnosis/comorbidity extraction, functional impairment sensitivity, and HIPPS/HHRG preview against recalibrated 2026 weights.
3. **LUPA & Visit Utilization Leakage** — Day-0 predictive risk scoring, utilization dashboards, and ranked intervention tasking before thresholds are crossed.
4. **Referral Intake Friction & Conversion Loss** — Multi-channel unified inbox, AI triage/prioritization, structured digital intake, eligibility/F2F/consent automation, and conversion funnel analytics.
5. **HHVBP Performance Attribution** — Near-real-time clinician/team attribution, predictive TPS trajectory, and actionable coaching prompts.

All design choices remain tightly aligned with Medicare Conditions of Participation, OASIS-E2 (effective April 1, 2026), CY 2026 PDGM recalibration (CY 2024 claims data), expanded HHVBP measures, HIPAA Security/Privacy Rules, and real field realities (offline mobile, secure wound photography, geotag/timestamp/nurse-ID metadata).

**Status:** Phase 0–2 production-hardened (compliant intake + secure field wound photos). Phase 3 (OASIS-E2 + advisory PDGM/LUPA) in active development. Progressive enhancement roadmap continues through full Case-Mix Optimizer, LUPA Sentinel, and HHVBP Compass.

**Not for production PHI** until AWS BAA (or equivalent), formal security review, compliance officer sign-off, and legal validation of all templates/rules.

## Core Design Principles (AetherCare UX)

- Compliance as invisible guardrail, not friction.
- AI as transparent co-pilot: every suggestion shows confidence, source evidence, “why,” and one-tap Accept/Edit/Dismiss with full immutable lineage. Never auto-locks clinical eligibility, medical necessity, or billing-critical decisions.
- Mobile-first / offline-first for field clinicians; progressive enhancement for office.
- Role-adaptive density and progressive disclosure.
- Observable, overridable, attributable automation.
- Consistent risk visualization (LUPA, Coding/Denial, Compliance Gap, Revenue Opportunity).

## Architecture (short)

- **Mobile (Expo prebuild / dev client):** field nurses — visits, consents, camera-only wound photos offline-first with encrypted outbox.
- **Web (Next.js):** intake, coordinators, coding workbench, LUPA sentinel, admin, compliance, episode photo gallery, OASIS guided assessment.
- **API (NestJS):** domain services, RBAC, comprehensive audit, validation, photo envelope crypto (AES-GCM), multi-tenant RLS.
- **Postgres + Drizzle:** relational PHI with org scoping and row-level security.
- **S3/MinIO + KMS (prod):** private encrypted photo/document objects.

See `AGENTS.md` for coding and compliance conventions.  
See `docs/architecture/` for phase plans (including Phase 3 OASIS-E2/PDGM).  
See `docs/compliance/` for threat model, checklists, and BAA inventory.

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker Desktop (Postgres, Redis, MinIO)
- **Mobile photos:** Expo prebuild / EAS dev client (Expo Go unsupported for capture crypto)

## Quick start

```bash
cd ~/hhos   # or your clone path
cp .env.example .env
pnpm install
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm --filter @hhos/api dev
# other terminal
pnpm --filter @hhos/web dev
```

- API: http://localhost:3001  
- API docs (Swagger): http://localhost:3001/docs  
- Web: http://localhost:3000  
- MinIO console: http://localhost:9001  

### Demo users (synthetic)

| Email | Role |
|-------|------|
| coord@demo.local | intake_coordinator |
| rn@demo.local | field_rn |
| lead@demo.local | clinical_lead |
| compliance@demo.local | compliance |

Local auth uses `POST /v1/auth/dev-login` with email (dev only).

## Phase 2 run notes (wound photos)

Photos are gated and storage-sensitive. Local dogfood checklist:

| Concern | Env / action |
|---------|----------------|
| Master API switch | `FEATURE_WOUND_PHOTOS=true` (default **false** when unset — set in `.env` from `.env.example`) |
| Photo envelope KEK | `PHOTO_KEK` — 64 hex or 32-byte base64; **separate** from `FIELD_ENCRYPTION_KEY` |
| Internal storage (API ops) | `S3_ENDPOINT` (e.g. `http://localhost:9000` or `http://minio:9000` in compose network) |
| Device-facing presign Host | `S3_PUBLIC_ENDPOINT` (e.g. `http://127.0.0.1:9000` simulator; `http://10.0.2.2:9000` Android emulator; `http://<LAN-IP>:9000` physical device). **Never rewrite** signed URL hosts after issue (SigV4). |
| Geotag | Fail-closed: leave `PHOTO_GEOTAG_ENABLED=false` unless deliberately testing **and** org setting enabled |
| Mobile build | `pnpm --filter @hhos/mobile exec expo prebuild` then `expo run:ios` / `run:android` (or EAS dev client). See `apps/mobile/README.md`. |
| Consent | Capture requires active `WOUND_PHOTO_CLINICAL` (online fetch + cache; no gallery clinical path) |
| Device | App registers via `POST /v1/devices/register` before sync; revoke is API-side |

## Workspace layout

```
apps/api       NestJS API
apps/web       Next.js console (AetherCare UX)
apps/mobile    Expo field app (prebuild for photos)
packages/db    Drizzle schema, migrations, seeds
packages/shared  Zod schemas, permissions, enums, PDGM/LUPA advisory helpers, OASIS-E2 subset
docs/          Architecture, compliance, domain
infra/         Terraform stubs (AWS)
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all workspaces |
| `pnpm build` | Build packages/apps |
| `pnpm typecheck` | TypeScript check |
| `pnpm test` | Workspace tests |
| `pnpm --filter @hhos/api test` | API unit tests (crypto vectors, dual-S3, photo control plane) |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:seed` | Seed synthetic demo data |

## Compliance notice (critical)

- **All clinical, coding, eligibility, medical necessity, and billing-critical logic is assistive / advisory only.** Human override and full audit trail are mandatory.
- Consent template wording is **placeholder — NOT LEGAL FINAL**.  
- No production ePHI without executed BAAs, org policy approval, and formal review by the agency’s compliance officer, legal counsel, and MAC.
- Clinical photos: camera-only; consent purpose `WOUND_PHOTO_CLINICAL`; post-revoke view follows break-glass rules for compliance only.
- CY 2026 PDGM weights, LUPA thresholds, OASIS-E2 item definitions, and HHVBP measures must be re-validated against official CMS final rules and guidance before any production lock or payment impact.
- This platform is designed so that every automation remains observable, overridable, and fully auditable.

## License

Proprietary — All rights reserved.
