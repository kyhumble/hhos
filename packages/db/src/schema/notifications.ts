import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  index,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

export const notificationChannelEnum = pgEnum('notification_channel', [
  'email',
  'sms',
]);

export const notificationStatusEnum = pgEnum('notification_status', [
  'pending',
  'sent',
  'failed',
  'suppressed',
]);

/**
 * Outbound notification deliveries (Phase 9).
 * Never store magic tokens, patient names, DOB, or clinical free text here.
 */
export const notificationDeliveries = pgTable(
  'notification_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    channel: notificationChannelEnum('channel').notNull().default('email'),
    /** e.g. org_invite | physician_sign */
    template: text('template').notNull(),
    toAddress: text('to_address').notNull(),
    status: notificationStatusEnum('status').notNull().default('pending'),
    provider: text('provider').notNull(),
    providerMessageId: text('provider_message_id'),
    attemptCount: integer('attempt_count').notNull().default(0),
    lastErrorCode: text('last_error_code'),
    relatedType: text('related_type'),
    relatedId: uuid('related_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
  },
  (t) => ({
    orgStatusIdx: index('notification_deliveries_org_status_idx').on(t.orgId, t.status),
    relatedIdx: index('notification_deliveries_related_idx').on(t.relatedType, t.relatedId),
  }),
);
