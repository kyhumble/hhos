import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

export const userStatusEnum = pgEnum('user_status', ['active', 'disabled', 'invited']);

export const roleCodeEnum = pgEnum('role_code', [
  'field_rn',
  'intake_coordinator',
  'clinical_lead',
  'billing',
  'compliance',
  'admin',
]);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    cognitoSub: text('cognito_sub'),
    email: text('email').notNull(),
    fullName: text('full_name').notNull(),
    phone: text('phone'),
    status: userStatusEnum('status').notNull().default('active'),
    mfaRequired: boolean('mfa_required').notNull().default(false),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailOrgIdx: uniqueIndex('users_org_email_uidx').on(t.orgId, t.email),
    cognitoIdx: uniqueIndex('users_cognito_sub_uidx').on(t.cognitoSub),
  }),
);

export const roles = pgTable(
  'roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    code: roleCodeEnum('code').notNull(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgCodeIdx: uniqueIndex('roles_org_code_uidx').on(t.orgId, t.code),
  }),
);

export const permissions = pgTable('permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  description: text('description'),
});

export const rolePermissions = pgTable(
  'role_permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id),
  },
  (t) => ({
    rolePermIdx: uniqueIndex('role_permissions_uidx').on(t.roleId, t.permissionId),
  }),
);

export const userRoles = pgTable(
  'user_roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userRoleIdx: uniqueIndex('user_roles_uidx').on(t.userId, t.roleId),
  }),
);
