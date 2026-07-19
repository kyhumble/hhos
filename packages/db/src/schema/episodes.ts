import {
  boolean,
  date,
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
import { referrals } from './referrals';
import { users } from './users';

export const episodeStatusEnum = pgEnum('episode_status', [
  'pre_admit',
  'scheduled_soc',
  'active',
  'hold',
  'discharged',
  'non_admit',
]);

export const careTypeEnum = pgEnum('care_type', [
  'home_health',
  'wound_only',
  'hospice',
  'other',
]);

export const f2fStatusEnum = pgEnum('f2f_status', [
  'unknown',
  'scheduled',
  'completed',
  'missing',
  'waived_review',
]);

export const ordersStatusEnum = pgEnum('orders_status', [
  'missing',
  'verbal',
  'signed',
  'expired',
]);

export const pocStatusEnum = pgEnum('poc_status', [
  'not_started',
  'draft',
  'pending_signature',
  'signed',
]);

export const intakeStatusEnum = pgEnum('intake_status', [
  'incomplete',
  'ready_for_soc',
  'complete',
]);

export const careTeamRoleEnum = pgEnum('care_team_role', [
  'primary_rn',
  'covering_rn',
  'intake',
  'clinical_lead',
]);

export const checklistCodeEnum = pgEnum('checklist_code', [
  'DEMOGRAPHICS_COMPLETE',
  'SERVICE_ADDRESS',
  'PRIMARY_COVERAGE',
  'COVERAGE_VERIFIED',
  'NPP_ACK',
  'ADMISSION_CONSENT',
  'PHOTO_CONSENT',
  'ROI',
  'FINANCIAL',
  'F2F_STATUS_KNOWN',
  'ORDERS_STATUS_KNOWN',
  'PRIMARY_DX_PRESENT',
  'HISTORY_STARTED',
  'SURROGATE_DOCUMENTED',
]);

export const checklistItemStatusEnum = pgEnum('checklist_item_status', [
  'pending',
  'complete',
  'waived',
  'blocked',
]);

export const orderTypeEnum = pgEnum('order_type', [
  'f2f',
  'plan_of_care',
  'verbal_order',
  'supply',
  'other',
]);

export const timelineEventTypeEnum = pgEnum('timeline_event_type', [
  'referral_received',
  'intake_started',
  'consent_captured',
  'soc_scheduled',
  'soc_completed',
  'flag_raised',
  'owner_changed',
  'episode_accepted',
]);

export const episodes = pgTable(
  'episodes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id),
    referralId: uuid('referral_id').references(() => referrals.id),
    episodeNumber: integer('episode_number').notNull().default(1),
    careType: careTypeEnum('care_type').notNull().default('wound_only'),
    status: episodeStatusEnum('status').notNull().default('pre_admit'),
    referralReceivedAt: timestamp('referral_received_at', { withTimezone: true }).notNull(),
    socDueAt: timestamp('soc_due_at', { withTimezone: true }),
    socScheduledAt: timestamp('soc_scheduled_at', { withTimezone: true }),
    socCompletedAt: timestamp('soc_completed_at', { withTimezone: true }),
    socClinicianId: uuid('soc_clinician_id').references(() => users.id),
    nonAdmitReason: text('non_admit_reason'),
    admissionSource: text('admission_source'),
    primaryDxIcd10: text('primary_dx_icd10'),
    f2fStatus: f2fStatusEnum('f2f_status').notNull().default('unknown'),
    f2fDate: date('f2f_date'),
    ordersStatus: ordersStatusEnum('orders_status').notNull().default('missing'),
    pocStatus: pocStatusEnum('poc_status').notNull().default('not_started'),
    intakeStatus: intakeStatusEnum('intake_status').notNull().default('incomplete'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id),
    updatedBy: uuid('updated_by').references(() => users.id),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    referralUnique: uniqueIndex('episodes_referral_uidx').on(t.referralId),
  }),
);

export const careTeamMembers = pgTable('care_team_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id),
  episodeId: uuid('episode_id')
    .notNull()
    .references(() => episodes.id),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  teamRole: careTeamRoleEnum('team_role').notNull(),
  active: boolean('active').notNull().default(true),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  assignedBy: uuid('assigned_by').references(() => users.id),
});

export const intakeChecklistItems = pgTable(
  'intake_checklist_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    episodeId: uuid('episode_id')
      .notNull()
      .references(() => episodes.id),
    code: checklistCodeEnum('code').notNull(),
    required: boolean('required').notNull().default(true),
    status: checklistItemStatusEnum('status').notNull().default('pending'),
    blockedReason: text('blocked_reason'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    completedBy: uuid('completed_by').references(() => users.id),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    episodeCodeIdx: uniqueIndex('intake_checklist_episode_code_uidx').on(t.episodeId, t.code),
  }),
);

export const ordersTracking = pgTable('orders_tracking', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id),
  episodeId: uuid('episode_id')
    .notNull()
    .references(() => episodes.id),
  orderType: orderTypeEnum('order_type').notNull(),
  status: text('status').notNull().default('missing'),
  orderedAt: timestamp('ordered_at', { withTimezone: true }),
  signedAt: timestamp('signed_at', { withTimezone: true }),
  physicianName: text('physician_name'),
  physicianNpi: text('physician_npi'),
  documentMetaId: uuid('document_meta_id'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const clinicalDocumentsMeta = pgTable('clinical_documents_meta', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id),
  patientId: uuid('patient_id')
    .notNull()
    .references(() => patients.id),
  episodeId: uuid('episode_id').references(() => episodes.id),
  docType: text('doc_type').notNull(),
  filename: text('filename').notNull(),
  contentType: text('content_type').notNull(),
  storageKey: text('storage_key').notNull(),
  sha256: text('sha256').notNull(),
  uploadedBy: uuid('uploaded_by').references(() => users.id),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const episodeTimelineEvents = pgTable('episode_timeline_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id),
  episodeId: uuid('episode_id')
    .notNull()
    .references(() => episodes.id),
  eventType: timelineEventTypeEnum('event_type').notNull(),
  summary: text('summary').notNull(),
  metadata: text('metadata'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  actorUserId: uuid('actor_user_id').references(() => users.id),
});
