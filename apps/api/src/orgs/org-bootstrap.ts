/**
 * Bootstrap default roles + role_permissions for a new organization.
 * Permissions rows are global; roles are per-org.
 */
import { and, eq } from 'drizzle-orm';
import {
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
  RoleCode,
  type RoleCode as RoleCodeType,
} from '@hhos/shared';
import {
  permissions,
  rolePermissions,
  roles,
  type HhosDb,
} from '@hhos/db';

const ROLE_NAMES: Record<RoleCodeType, string> = {
  field_rn: 'Field RN',
  intake_coordinator: 'Intake Coordinator',
  clinical_lead: 'Clinical Lead',
  billing: 'Billing',
  compliance: 'Compliance',
  admin: 'Admin',
};

export async function ensureGlobalPermissions(db: HhosDb): Promise<Map<string, string>> {
  for (const code of ALL_PERMISSIONS) {
    await db.insert(permissions).values({ code, description: code }).onConflictDoNothing();
  }
  const all = await db.select().from(permissions);
  return new Map(all.map((p) => [p.code, p.id]));
}

export async function bootstrapOrgRoles(
  db: HhosDb,
  orgId: string,
  permByCode?: Map<string, string>,
): Promise<Map<RoleCodeType, string>> {
  const map = permByCode ?? (await ensureGlobalPermissions(db));
  const roleIdByCode = new Map<RoleCodeType, string>();

  for (const code of RoleCode) {
    const [inserted] = await db
      .insert(roles)
      .values({
        orgId,
        code,
        name: ROLE_NAMES[code],
      })
      .onConflictDoNothing()
      .returning();

    let roleId = inserted?.id;
    if (!roleId) {
      const [found] = await db
        .select()
        .from(roles)
        .where(and(eq(roles.orgId, orgId), eq(roles.code, code)))
        .limit(1);
      roleId = found?.id;
    }
    if (!roleId) continue;
    roleIdByCode.set(code, roleId);

    for (const p of ROLE_PERMISSIONS[code]) {
      const permissionId = map.get(p);
      if (!permissionId) continue;
      await db
        .insert(rolePermissions)
        .values({ roleId, permissionId })
        .onConflictDoNothing();
    }
  }

  return roleIdByCode;
}
