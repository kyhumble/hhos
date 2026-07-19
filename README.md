# HHOS — Home Health Operating System

Custom, HIPAA-by-design operating system for mobile wound care agencies.

**Status:** Phase 0–2 implementation in progress  
**MVP target:** Phase 0–2 (compliant intake + secure field wound photos)  
**Not for production PHI** until AWS BAA, security review, and compliance sign-off.

## Architecture (short)

- **Mobile (Expo prebuild / dev client):** field nurses — visits, consents, camera-only wound photos offline  
- **Web (Next.js):** intake, coordinators, admin, compliance, episode photo gallery  
- **API (NestJS):** domain services, RBAC, audit, validation, photo envelope crypto  
- **Postgres + Drizzle:** relational PHI with org scoping  
- **S3/MinIO + KMS (prod):** private encrypted photo/document objects  

See `AGENTS.md` for coding and compliance conventions.  
See `docs/architecture/overview.md` and **`docs/architecture/phase-2-secure-wound-photos.md`** for Phase 2 design.  
See `docs/architecture/phase-2-kpis.md` for ops metrics (ids only).  
See `docs/compliance/threat-model-v0.md` for threat model including the photo pipeline.

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker Desktop (Postgres, Redis, MinIO)
- **Mobile photos:** Expo prebuild / EAS dev client (Expo Go unsupported for capture crypto)

## Quick start

```bash
cd ~/hhos
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
| Device | App registers via `POST /v1/devices/register` before sync; revoke is API-side (not a hardening-only concern) |

Minimal photo-local flow:

```bash
# 1) deps
docker compose up -d          # postgres, redis, minio + private bucket/CORS init
cp .env.example .env          # ensure FEATURE_WOUND_PHOTOS, PHOTO_KEK, S3_* set
pnpm install && pnpm db:migrate && pnpm db:seed

# 2) API + web
pnpm --filter @hhos/api dev
pnpm --filter @hhos/web dev

# 3) mobile (dev client — not Expo Go)
pnpm --filter @hhos/mobile exec expo prebuild
# set EXPO_PUBLIC_API_URL for device/emulator as needed
pnpm --filter @hhos/mobile exec expo run:ios   # or run:android
```

## Workspace layout

```
apps/api       NestJS API
apps/web       Next.js console
apps/mobile    Expo field app (prebuild for photos)
packages/db    Drizzle schema, migrations, seeds
packages/shared  Zod schemas, permissions, enums
docs/          Architecture & compliance
infra/         Terraform stubs (AWS)
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all workspaces |
| `pnpm build` | Build packages/apps |
| `pnpm typecheck` | TypeScript check |
| `pnpm test` | Workspace tests (API unit tests via turbo) |
| `pnpm --filter @hhos/api test` | API unit tests (crypto vectors, dual-S3 construction, photo control plane — **no live MinIO required**) |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:seed` | Seed synthetic demo data |

### CI & MinIO

GitHub Actions (`.github/workflows/ci.yml`) runs install, shared/db build, typecheck, and a basic secret scan. **Unit tests do not start MinIO**; storage specs assert dual-client construction and never rewrite signed hosts.

For a **compose-backed local smoke** of object storage:

```bash
docker compose up -d
# confirm MinIO healthy; bucket hhos-documents private + CORS applied by minio-init
pnpm --filter @hhos/api test          # unit suite
# Manual smoke: initiate → presigned PUT to S3_PUBLIC_ENDPOINT → complete (hash via internal client)
# See docs/architecture/phase-2-kpis.md smoke checklist
```

A live MinIO integration job in CI is optional follow-on; document any new `test:integration` script here when added.

## Compliance notice

- Consent template wording is **placeholder — NOT LEGAL FINAL**.  
- No production ePHI without executed BAAs and org policy approval.  
- Recommend Compliance Officer / counsel review before pilot with real patients.
- Clinical photos: camera-only; consent purpose `WOUND_PHOTO_CLINICAL`; post-revoke view follows K16 (break-glass for compliance only).

## License

Proprietary — All rights reserved.
