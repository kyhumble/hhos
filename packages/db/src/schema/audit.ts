import { jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { users } from './users';

export const auditActorTypeEnum = pgEnum('audit_actor_type', [
  'user',
  'system',
  'break_glass',
]);

/**
 * Append-only audit log. Application DB role must not have UPDATE/DELETE on this table in prod.
 * before/after payloads should be redacted per policy — never log full SSN/member id.
 */
export const auditEvents = pgTable('audit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  actorUserId: uuid('actor_user_id').references(() => users.id),
  actorType: auditActorTypeEnum('actor_type').notNull().default('user'),
  action: text('action').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: uuid('resource_id'),
  patientId: uuid('patient_id'),
  episodeId: uuid('episode_id'),
  ip: text('ip'),
  userAgent: text('user_agent'),
  deviceId: text('device_id'),
  before: jsonb('before'),
  after: jsonb('after'),
  reason: text('reason'),
  requestId: text('request_id'),
});
