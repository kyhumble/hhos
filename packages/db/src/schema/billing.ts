import {
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  index,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { users } from './users';
import { patients } from './patients';
import { episodes } from './episodes';

export const billingClaimTypeEnum = pgEnum('billing_claim_type', [
  'hh_rap',
  'hh_final',
  'hospice_noe',
  'hospice_claim',
  'other',
]);

export const billingClaimStatusEnum = pgEnum('billing_claim_status', [
  'draft',
  'ready',
  'blocked',
  'exported',
  'submitted_external',
  'void',
]);

/**
 * Claim readiness package for external billing/clearinghouse handoff.
 * Does not submit to payers — export JSON only (Phase 7).
 */
export const billingClaimPackages = pgTable(
  'billing_claim_packages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    episodeId: uuid('episode_id')
      .notNull()
      .references(() => episodes.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id),
    claimType: billingClaimTypeEnum('claim_type').notNull(),
    status: billingClaimStatusEnum('status').notNull().default('draft'),
    serviceFrom: date('service_from'),
    serviceTo: date('service_to'),
    notes: text('notes'),
    /** Readiness gaps at last refresh. */
    gapsJson: jsonb('gaps_json').$type<unknown[]>().notNull().default([]),
    readinessSnapshotJson: jsonb('readiness_snapshot_json')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    hardGapCount: integer('hard_gap_count').notNull().default(0),
    exportFormat: text('export_format'),
    exportPayloadJson: jsonb('export_payload_json').$type<Record<string, unknown>>(),
    exportedAt: timestamp('exported_at', { withTimezone: true }),
    exportedBy: uuid('exported_by').references(() => users.id),
    externalRef: text('external_ref'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    submittedBy: uuid('submitted_by').references(() => users.id),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidedBy: uuid('voided_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id),
  },
  (t) => ({
    orgStatusIdx: index('billing_claim_packages_org_status_idx').on(t.orgId, t.status),
    episodeIdx: index('billing_claim_packages_episode_idx').on(t.episodeId),
  }),
);
