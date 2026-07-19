/**
 * Multi-tenant RLS helpers (Phase 8).
 * Prefer transaction-local set_config (is_local=true) so pool reuse is safe.
 *
 * Superusers / BYPASSRLS roles ignore RLS — use `hhos_app` (see migration 0008).
 */
import { sql } from 'drizzle-orm';
import type { HhosDb } from './client';

export type RlsContext = {
  /** Tenant UUID for app.current_org_id */
  orgId?: string | null;
  /** When true, policies allow all rows (public routes, seed, migrate). */
  bypass?: boolean;
};

/** Apply GUC settings on a Drizzle db/tx (is_local=true requires open transaction). */
export async function applyRlsConfig(
  db: Pick<HhosDb, 'execute'>,
  ctx: RlsContext,
): Promise<void> {
  await db.execute(sql`select set_config('app.rls_enforced', 'on', true)`);
  if (ctx.bypass) {
    await db.execute(sql`select set_config('app.rls_bypass', 'on', true)`);
    await db.execute(sql`select set_config('app.current_org_id', '', true)`);
    return;
  }
  if (ctx.orgId) {
    await db.execute(sql`select set_config('app.rls_bypass', 'off', true)`);
    await db.execute(
      sql`select set_config('app.current_org_id', ${ctx.orgId}, true)`,
    );
    return;
  }
  await db.execute(sql`select set_config('app.rls_bypass', 'off', true)`);
  await db.execute(sql`select set_config('app.current_org_id', '', true)`);
}

/**
 * Run work inside a Drizzle transaction with RLS GUC context.
 * Effective only when the DB role is not superuser / BYPASSRLS.
 */
export async function withRlsContext<T>(
  db: HhosDb,
  ctx: RlsContext,
  fn: (tx: HhosDb) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await applyRlsConfig(tx as unknown as Pick<HhosDb, 'execute'>, ctx);
    return fn(tx as unknown as HhosDb);
  });
}

/** Build app-role URL for RLS-enforced connections (local default password). */
export function appRoleDatabaseUrl(
  baseUrl = process.env.DATABASE_URL ??
    'postgresql://hhos:hhos_dev@localhost:5432/hhos',
): string {
  try {
    const u = new URL(baseUrl);
    u.username = 'hhos_app';
    u.password = process.env.DATABASE_APP_PASSWORD ?? 'hhos_app_dev';
    return u.toString();
  } catch {
    return 'postgresql://hhos_app:hhos_app_dev@localhost:5432/hhos';
  }
}
