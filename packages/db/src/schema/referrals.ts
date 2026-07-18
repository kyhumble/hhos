import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { patients } from './patients';
import { users } from './users';

export const referralSourceTypeEnum = pgEnum('referral_source_type', [
  'hospital',
  'physician',
  'snf',
  'self',
  'other',
]);

export const referralStatusEnum = pgEnum('referral_status', [
  'new',
  'in_review',
  'accepted',
  'declined',
  'converted',
  'cancelled',
]);

export const referralAcuityEnum = pgEnum('referral_acuity', [
  'routine',
  'urgent',
  'expedited',
]);

export const referrals = pgTable(
  'referrals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id),
    externalRef: text('external_ref'),
    sourceType: referralSourceTypeEnum('source_type').notNull(),
    sourceName: text('source_name').notNull(),
    sourceContact: text('source_contact'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    acuity: referralAcuityEnum('acuity').default('routine'),
    reasonForReferral: text('reason_for_referral').notNull(),
    primaryDiagnosisText: text('primary_diagnosis_text'),
    primaryDiagnosisIcd10: text('primary_diagnosis_icd10'),
    /** JSON array of service codes stored as text for simplicity in Phase 0 */
    requestedServices: text('requested_services').notNull().default('["wound"]'),
    status: referralStatusEnum('status').notNull().default('new'),
    declineReason: text('decline_reason'),
    intakeOwnerId: uuid('intake_owner_id').references(() => users.id),
    completenessScore: integer('completeness_score').notNull().default(0),
    idempotencyKey: text('idempotency_key'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id),
    updatedBy: uuid('updated_by').references(() => users.id),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    idempotencyIdx: uniqueIndex('referrals_idempotency_uidx').on(t.orgId, t.idempotencyKey),
  }),
);
