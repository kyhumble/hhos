import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  npi: text('npi'),
  timezone: text('timezone').notNull().default('America/Chicago'),
  settings: jsonb('settings')
    .$type<{
      socDueHours?: number;
      photoGeotagEnabled?: boolean;
      coverageVerifiedRequired?: boolean;
      woundPathwayDefault?: boolean;
    }>()
    .notNull()
    .default({
      socDueHours: 48,
      photoGeotagEnabled: false,
      coverageVerifiedRequired: false,
      woundPathwayDefault: true,
    }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
