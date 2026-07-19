import { jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/** Org-level settings + multi-tenant feature flags (see @hhos/shared OrgSettings). */
export type OrgSettingsJson = {
  socDueHours?: number;
  photoGeotagEnabled?: boolean;
  coverageVerifiedRequired?: boolean;
  woundPathwayDefault?: boolean;
  largeWoundLengthCm?: number;
  largeWoundWidthCm?: number;
  largeWoundAreaCm2?: number;
  photoMaxBytes?: number;
  photoPendingTtlHours?: number;
  features?: {
    woundPhotos?: boolean;
    oasis?: boolean;
    serviceAi?: boolean;
    ordersEsign?: boolean;
    hospice?: boolean;
  };
};

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    /** URL-safe unique tenant key (login disambiguation, future subdomains). */
    slug: text('slug').notNull(),
    npi: text('npi'),
    timezone: text('timezone').notNull().default('America/Chicago'),
    settings: jsonb('settings')
      .$type<OrgSettingsJson>()
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
        features: {
          woundPhotos: true,
          oasis: true,
          serviceAi: true,
          ordersEsign: true,
          hospice: true,
        },
      }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugUidx: uniqueIndex('organizations_slug_uidx').on(t.slug),
  }),
);
