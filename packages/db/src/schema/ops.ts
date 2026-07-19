import {
  boolean,
  doublePrecision,
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
import { users } from './users';
import { patients } from './patients';
import { episodes } from './episodes';

export const routeSuggestionStatusEnum = pgEnum('route_suggestion_status', [
  'pending',
  'accepted',
  'rejected',
  'superseded',
  'expired',
]);

export const visitTaskTypeEnum = pgEnum('visit_task_type', [
  'soc_visit',
  'skilled_visit',
  'wound_reassessment',
  'oasis_followup',
  'supply_drop',
  'hospitalization_followup',
  'other',
]);

export const visitTaskStatusEnum = pgEnum('visit_task_status', [
  'open',
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
]);

export const hospitalizationAlertStatusEnum = pgEnum('hospitalization_alert_status', [
  'new',
  'acknowledged',
  'in_progress',
  'resolved',
  'false_positive',
]);

export const clinicianProfiles = pgTable(
  'clinician_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    skillsJson: jsonb('skills_json').$type<string[]>().notNull().default([]),
    languagesJson: jsonb('languages_json').$type<string[]>().notNull().default(['en']),
    homeBaseCity: text('home_base_city'),
    homeBaseState: text('home_base_state'),
    homeBasePostal: text('home_base_postal'),
    homeBaseLat: doublePrecision('home_base_lat'),
    homeBaseLng: doublePrecision('home_base_lng'),
    maxDailyVisits: integer('max_daily_visits').notNull().default(6),
    activeForRouting: boolean('active_for_routing').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userUidx: uniqueIndex('clinician_profiles_user_uidx').on(t.userId),
    orgIdx: index('clinician_profiles_org_idx').on(t.orgId),
  }),
);

export const routeSuggestions = pgTable(
  'route_suggestions',
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
    suggestedUserId: uuid('suggested_user_id')
      .notNull()
      .references(() => users.id),
    status: routeSuggestionStatusEnum('status').notNull().default('pending'),
    scoreTotal: integer('score_total').notNull().default(0),
    scoreBreakdownJson: jsonb('score_breakdown_json')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    requiredSkillsJson: jsonb('required_skills_json').$type<string[]>().notNull().default([]),
    engineVersion: text('engine_version').notNull().default('rules-v1'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decidedBy: uuid('decided_by').references(() => users.id),
    decisionReasonCode: text('decision_reason_code'),
    decisionNote: text('decision_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id),
  },
  (t) => ({
    episodePendingIdx: index('route_suggestions_episode_status_idx').on(t.episodeId, t.status),
    orgStatusIdx: index('route_suggestions_org_status_idx').on(t.orgId, t.status),
  }),
);

export const visitTasks = pgTable(
  'visit_tasks',
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
    taskType: visitTaskTypeEnum('task_type').notNull(),
    status: visitTaskStatusEnum('status').notNull().default('open'),
    title: text('title').notNull(),
    description: text('description'),
    priority: text('priority').notNull().default('routine'),
    dueAt: timestamp('due_at', { withTimezone: true }),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    assigneeUserId: uuid('assignee_user_id').references(() => users.id),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    completedBy: uuid('completed_by').references(() => users.id),
    completionNote: text('completion_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    orgStatusIdx: index('visit_tasks_org_status_idx').on(t.orgId, t.status),
    assigneeIdx: index('visit_tasks_assignee_idx').on(t.assigneeUserId, t.status),
  }),
);

export const hospitalizationAlerts = pgTable(
  'hospitalization_alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id),
    episodeId: uuid('episode_id').references(() => episodes.id),
    facilityName: text('facility_name').notNull(),
    admittedAt: timestamp('admitted_at', { withTimezone: true }),
    source: text('source').notNull().default('manual'),
    status: hospitalizationAlertStatusEnum('status').notNull().default('new'),
    notes: text('notes'),
    externalRef: text('external_ref'),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    acknowledgedBy: uuid('acknowledged_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id),
  },
  (t) => ({
    orgStatusIdx: index('hospitalization_alerts_org_status_idx').on(t.orgId, t.status),
    patientIdx: index('hospitalization_alerts_patient_idx').on(t.patientId),
  }),
);
