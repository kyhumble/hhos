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
      /** Large-wound review thresholds (cm / cm²). App defaults if unset. */
      largeWoundLengthCm?: number;
      largeWoundWidthCm?: number;
      largeWoundAreaCm2?: number;
      /** Max ciphertext bytes for a single photo object. Default 12_000_000. */
      photoMaxBytes?: number;
      /** Hours before pending upload rows are GC'd as orphans. Default 24. */
      photoPendingTtlHours?: number;
    }>()
    .notNull()
    .default({
      socDueHours: 48,
      photoGeotagEnabled: false,
      coverageVerifiedRequired: false,
      woundPathwayDefault: true,
      largeWoundLengthCm: 10,
      largeWoundWidthCm: 10,
      largeWoundAreaCm2: 50,
      photoMaxBytes: 12_000_000,
      photoPendingTtlHours: 24,
    }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
