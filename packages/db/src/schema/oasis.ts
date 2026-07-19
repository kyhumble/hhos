import {
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  index,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { patients } from './patients';
import { episodes } from './episodes';
import { users } from './users';

export const oasisTimepointEnum = pgEnum('oasis_timepoint', [
  'SOC',
  'ROC',
  'FU',
  'RECERT',
  'TRANS',
  'DEATH',
  'DISCH',
]);

export const oasisAssessmentStatusEnum = pgEnum('oasis_assessment_status', [
  'draft',
  'in_review',
  'locked',
  'void',
]);

export const oasisAssessments = pgTable(
  'oasis_assessments',
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
    timepoint: oasisTimepointEnum('timepoint').notNull().default('SOC'),
    itemSetVersion: text('item_set_version').notNull(),
    status: oasisAssessmentStatusEnum('status').notNull().default('draft'),
    assessmentDate: date('assessment_date'),
    flagsJson: jsonb('flags_json').$type<unknown[]>().notNull().default([]),
    gapsJson: jsonb('gaps_json').$type<string[]>().notNull().default([]),
    pdgmHintJson: jsonb('pdgm_hint_json').$type<Record<string, unknown> | null>(),
    completenessScore: integer('completeness_score').notNull().default(0),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    submittedBy: uuid('submitted_by').references(() => users.id),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedBy: uuid('reviewed_by').references(() => users.id),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lockedBy: uuid('locked_by').references(() => users.id),
    reviewNote: text('review_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id),
    updatedBy: uuid('updated_by').references(() => users.id),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    episodeTimepointIdx: index('oasis_assessments_episode_timepoint_idx').on(
      t.episodeId,
      t.timepoint,
    ),
    orgStatusIdx: index('oasis_assessments_org_status_idx').on(t.orgId, t.status),
  }),
);

export const oasisItemResponses = pgTable(
  'oasis_item_responses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    assessmentId: uuid('assessment_id')
      .notNull()
      .references(() => oasisAssessments.id),
    itemId: text('item_id').notNull(),
    itemCode: text('item_code').notNull(),
    valueJson: jsonb('value_json').$type<string | number | boolean | null>(),
    answeredAt: timestamp('answered_at', { withTimezone: true }).notNull().defaultNow(),
    answeredBy: uuid('answered_by').references(() => users.id),
  },
  (t) => ({
    assessmentItemUidx: uniqueIndex('oasis_item_responses_assessment_item_uidx').on(
      t.assessmentId,
      t.itemId,
    ),
  }),
);
