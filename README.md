# HHOS — Home Health Operating System

Custom, HIPAA-by-design operating system for mobile wound care agencies.

**Status:** Phase 0 scaffold  
**MVP target:** Phase 0–2 (compliant intake + secure field wound photos)  
**Not for production PHI** until AWS BAA, security review, and compliance sign-off.

## Architecture (short)

- **Mobile (Expo):** field nurses — visits, consents, (Phase 2) camera-only wound photos offline  
- **Web (Next.js):** intake, coordinators, admin, compliance  
- **API (NestJS):** domain services, RBAC, audit, validation  
- **Postgres + Drizzle:** relational PHI with org scoping  
- **S3/MinIO + KMS (prod):** private documents/photos  

See `AGENTS.md` for coding and compliance conventions.  
See `docs/` for compliance checklists and domain notes.

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker Desktop (Postgres, Redis, MinIO)

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

## Workspace layout

```
apps/api       NestJS API
apps/web       Next.js console
apps/mobile    Expo field app shell
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
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:seed` | Seed synthetic demo data |

## Compliance notice

- Consent template wording is **placeholder — NOT LEGAL FINAL**.  
- No production ePHI without executed BAAs and org policy approval.  
- Recommend Compliance Officer / counsel review before pilot with real patients.

## License

Proprietary — All rights reserved.
