import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { users } from './users';

export const devicePlatformEnum = pgEnum('device_platform', ['ios', 'android']);

export const deviceStatusEnum = pgEnum('device_status', ['active', 'revoked']);

/**
 * Registered mobile installs. Photo upload ops require an active row for
 * (org_id, device_id). Register is upsert on that pair.
 */
export const devices = pgTable(
  'devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    /** App-generated UUID (text); unique per org. */
    deviceId: text('device_id').notNull(),
    platform: devicePlatformEnum('platform').notNull(),
    model: text('model'),
    osVersion: text('os_version'),
    appVersion: text('app_version').notNull(),
    status: deviceStatusEnum('status').notNull().default('active'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgDeviceIdx: uniqueIndex('devices_org_device_uidx').on(t.orgId, t.deviceId),
  }),
);

export const deviceRevocations = pgTable('device_revocations', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceRowId: uuid('device_row_id')
    .notNull()
    .references(() => devices.id),
  revokedAt: timestamp('revoked_at', { withTimezone: true }).notNull().defaultNow(),
  revokedByUserId: uuid('revoked_by_user_id')
    .notNull()
    .references(() => users.id),
  reason: text('reason').notNull(),
});
