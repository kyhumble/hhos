import {
  date,
  integer,
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

export const hospiceElectionStatusEnum = pgEnum('hospice_election_status', [
  'draft',
  'active',
  'revoked',
  'discharged',
  'transferred',
]);

export const hospiceLevelOfCareEnum = pgEnum('hospice_level_of_care', [
  'routine',
  'continuous',
  'respite',
  'gip',
]);

export const hospiceBenefitPeriodStatusEnum = pgEnum('hospice_benefit_period_status', [
  'open',
  'closed',
]);

export const hospicePlaceOfServiceEnum = pgEnum('hospice_place_of_service', [
  'home',
  'snf',
  'assisted_living',
  'inpatient',
  'other',
]);

export const hospiceElections = pgTable(
  'hospice_elections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id),
    episodeId: uuid('episode_id')
      .notNull()
      .references(() => episodes.id),
    status: hospiceElectionStatusEnum('status').notNull().default('draft'),
    electionDate: date('election_date').notNull(),
    effectiveDate: date('effective_date').notNull(),
    attendingPhysicianName: text('attending_physician_name').notNull(),
    attendingPhysicianNpi: text('attending_physician_npi'),
    certifyingPhysicianName: text('certifying_physician_name'),
    certifyingPhysicianNpi: text('certifying_physician_npi'),
    terminalDxIcd10: text('terminal_dx_icd10'),
    terminalDxText: text('terminal_dx_text'),
    placeOfService: hospicePlaceOfServiceEnum('place_of_service').notNull().default('home'),
    notes: text('notes'),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokeReason: text('revoke_reason'),
    /** Link to latest cert order package (Phase 5). */
    latestCertPackageId: uuid('latest_cert_package_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id),
    updatedBy: uuid('updated_by').references(() => users.id),
  },
  (t) => ({
    orgStatusIdx: index('hospice_elections_org_status_idx').on(t.orgId, t.status),
    patientIdx: index('hospice_elections_patient_idx').on(t.patientId),
    episodeIdx: index('hospice_elections_episode_idx').on(t.episodeId),
  }),
);

export const hospiceBenefitPeriods = pgTable(
  'hospice_benefit_periods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    electionId: uuid('election_id')
      .notNull()
      .references(() => hospiceElections.id),
    episodeId: uuid('episode_id')
      .notNull()
      .references(() => episodes.id),
    periodNumber: integer('period_number').notNull(),
    status: hospiceBenefitPeriodStatusEnum('status').notNull().default('open'),
    startDate: date('start_date').notNull(),
    /** Expected end (90/90/60 days); null if open-ended tracking. */
    endDate: date('end_date'),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    electionIdx: index('hospice_benefit_periods_election_idx').on(t.electionId),
  }),
);

export const hospiceLocStays = pgTable(
  'hospice_loc_stays',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    electionId: uuid('election_id')
      .notNull()
      .references(() => hospiceElections.id),
    episodeId: uuid('episode_id')
      .notNull()
      .references(() => episodes.id),
    levelOfCare: hospiceLevelOfCareEnum('level_of_care').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    reason: text('reason'),
    facilityName: text('facility_name'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id),
  },
  (t) => ({
    electionIdx: index('hospice_loc_stays_election_idx').on(t.electionId),
    openIdx: index('hospice_loc_stays_open_idx').on(t.electionId, t.endedAt),
  }),
);
