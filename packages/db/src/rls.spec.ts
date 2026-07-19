import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { eq, sql } from 'drizzle-orm';
import { appRoleDatabaseUrl, createDb, withRlsContext } from './index';
import { organizations, patients } from './schema/index';

const ORG_A = '00000000-0000-4000-8000-000000000001';
const ORG_B = '00000000-0000-4000-8000-000000009999';

describe('RLS org isolation (hhos_app role)', () => {
  // Owner/superuser for setup
  const adminDb = createDb(process.env.DATABASE_URL);
  // Non-superuser — subject to FORCE RLS
  const appDb = createDb(appRoleDatabaseUrl());

  after(async () => {
    await adminDb.execute(sql`select set_config('app.rls_bypass', 'on', false)`);
    await adminDb.delete(patients).where(eq(patients.orgId, ORG_B)).catch(() => undefined);
    await adminDb
      .delete(organizations)
      .where(eq(organizations.id, ORG_B))
      .catch(() => undefined);
  });

  it('denies other-org patients when org context is set', async () => {
    await adminDb.execute(sql`select set_config('app.rls_bypass', 'on', false)`);

    await adminDb
      .insert(organizations)
      .values({
        id: ORG_B,
        name: 'RLS Test Org B',
        slug: `rls-test-org-b-${Date.now()}`,
      })
      .onConflictDoNothing();

    await adminDb
      .insert(patients)
      .values({
        orgId: ORG_B,
        mrn: `RLS-B-${Date.now()}`,
        firstName: 'Other',
        lastName: 'Tenant',
        dob: '1960-01-01',
        sexAtBirth: 'unknown',
        capacityStatus: 'assumed_capacity',
        status: 'prospect',
      })
      .onConflictDoNothing();

    const seenAsA = await withRlsContext(appDb, { orgId: ORG_A }, async (tx) => {
      return tx.select({ orgId: patients.orgId, mrn: patients.mrn }).from(patients);
    });

    assert.ok(
      seenAsA.every((p) => p.orgId === ORG_A),
      `org A context leaked other tenants: ${JSON.stringify(seenAsA.map((p) => p.orgId))}`,
    );

    const seenAsB = await withRlsContext(appDb, { orgId: ORG_B }, async (tx) => {
      return tx.select({ orgId: patients.orgId }).from(patients);
    });
    assert.ok(seenAsB.every((p) => p.orgId === ORG_B));
    assert.ok(seenAsB.length >= 1);
  });
});
