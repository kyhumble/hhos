import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  index,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { users, roleCodeEnum } from './users';

export const orgInviteStatusEnum = pgEnum('org_invite_status', [
  'pending',
  'accepted',
  'revoked',
  'expired',
]);

/**
 * Multi-tenant user invites. Token is stored hashed; raw token returned once on create.
 */
export const orgInvites = pgTable(
  'org_invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    email: text('email').notNull(),
    fullName: text('full_name').notNull(),
    roleCode: roleCodeEnum('role_code').notNull(),
    status: orgInviteStatusEnum('status').notNull().default('pending'),
    /** SHA-256 hex of invite secret (never store raw token). */
    tokenHash: text('token_hash').notNull(),
    invitedUserId: uuid('invited_user_id').references(() => users.id),
    invitedBy: uuid('invited_by').references(() => users.id),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tokenUidx: uniqueIndex('org_invites_token_hash_uidx').on(t.tokenHash),
    orgEmailIdx: index('org_invites_org_email_idx').on(t.orgId, t.email),
    orgStatusIdx: index('org_invites_org_status_idx').on(t.orgId, t.status),
  }),
);
