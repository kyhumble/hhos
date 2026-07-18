import { sql } from 'drizzle-orm';
import {
  boolean,
  char,
  customType,
  doublePrecision,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { patients } from './patients';
import { episodes } from './episodes';
import { users } from './users';
import { consentRecords, purposeCodeEnum } from './consents';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

// ─── Enums ──────────────────────────────────────────────────────────────────

export const woundLateralityEnum = pgEnum('wound_laterality', [
  'left',
  'right',
  'bilateral',
  'midline',
  'na',
]);

export const woundStatusEnum = pgEnum('wound_status', [
  'active',
  'healed',
  'transferred',
  'void',
]);

export const visitTypeEnum = pgEnum('visit_type', ['soc', 'routine', 'prn', 'other']);

export const visitStatusEnum = pgEnum('visit_status', [
  'in_progress',
  'completed',
  'cancelled',
]);

export const woundPhotoStatusEnum = pgEnum('wound_photo_status', [
  'pending_upload',
  'pending_put',
  'available',
  'failed',
  'abandoned',
  'soft_deleted',
]);

/** Clinical capture source — gallery import is never allowed (AGENTS.md). */
export const captureSourceEnum = pgEnum('capture_source', ['app_camera']);

export const measurementMethodEnum = pgEnum('measurement_method', [
  'manual_ruler',
  'app_overlay',
  'unknown',
]);

export const annotationTypeEnum = pgEnum('annotation_type', [
  'vector_json',
  'overlay_png',
]);

/** Annotation object lifecycle mirrors photo pending/available pattern. */
export const annotationStatusEnum = pgEnum('annotation_status', [
  'pending_upload',
  'pending_put',
  'available',
  'failed',
  'abandoned',
  'soft_deleted',
]);

export const clinicalTaskTypeEnum = pgEnum('clinical_task_type', [
  'large_wound_review',
  'photo_qa',
  'other',
]);

export const clinicalTaskStatusEnum = pgEnum('clinical_task_status', [
  'open',
  'in_progress',
  'done',
  'cancelled',
]);

export const clinicalTaskPriorityEnum = pgEnum('clinical_task_priority', [
  'routine',
  'urgent',
]);

// ─── Tables ─────────────────────────────────────────────────────────────────

export const wounds = pgTable('wounds', {
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
  label: text('label').notNull(),
  bodySiteCode: text('body_site_code'),
  laterality: woundLateralityEnum('laterality').notNull(),
  /** Controlled list in @hhos/shared WoundType; stored as text for flexible expansion. */
  woundType: text('wound_type'),
  openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  status: woundStatusEnum('status').notNull().default('active'),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const visits = pgTable(
  'visits',
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
    clinicianUserId: uuid('clinician_user_id')
      .notNull()
      .references(() => users.id),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    visitType: visitTypeEnum('visit_type').notNull(),
    status: visitStatusEnum('status').notNull().default('in_progress'),
    clientVisitId: text('client_visit_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    orgClientVisitIdx: uniqueIndex('visits_org_client_visit_uidx')
      .on(t.orgId, t.clientVisitId)
      .where(sql`${t.clientVisitId} IS NOT NULL`),
  }),
);

export const woundPhotos = pgTable(
  'wound_photos',
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
    woundId: uuid('wound_id')
      .notNull()
      .references(() => wounds.id),
    visitId: uuid('visit_id').references(() => visits.id),
    consentRecordId: uuid('consent_record_id')
      .notNull()
      .references(() => consentRecords.id),
    clientPhotoId: text('client_photo_id').notNull(),
    status: woundPhotoStatusEnum('status').notNull().default('pending_upload'),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
    capturedByUserId: uuid('captured_by_user_id')
      .notNull()
      .references(() => users.id),
    /** App-generated device id; gate via devices.(org_id, device_id) at API layer. */
    deviceId: text('device_id').notNull(),
    deviceModel: text('device_model'),
    deviceOs: text('device_os'),
    appVersion: text('app_version'),
    geoLat: doublePrecision('geo_lat'),
    geoLng: doublePrecision('geo_lng'),
    geoAccuracyM: doublePrecision('geo_accuracy_m'),
    contentType: text('content_type').notNull().default('image/jpeg'),
    byteSize: integer('byte_size'),
    plaintextSha256: char('plaintext_sha256', { length: 64 }),
    cipherSha256: char('cipher_sha256', { length: 64 }),
    storageKey: text('storage_key'),
    wrappedDek: bytea('wrapped_dek'),
    kekKeyId: text('kek_key_id'),
    widthPx: integer('width_px'),
    heightPx: integer('height_px'),
    captureSource: captureSourceEnum('capture_source').notNull().default('app_camera'),
    purposeAtCapture: purposeCodeEnum('purpose_at_capture')
      .notNull()
      .default('WOUND_PHOTO_CLINICAL'),
    lengthCm: numeric('length_cm', { precision: 6, scale: 2 }),
    widthCm: numeric('width_cm', { precision: 6, scale: 2 }),
    depthCm: numeric('depth_cm', { precision: 6, scale: 2 }),
    measurementMethod: measurementMethodEnum('measurement_method'),
    isLargeWound: boolean('is_large_wound').notNull().default(false),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    orgClientPhotoIdx: uniqueIndex('wound_photos_org_client_photo_uidx').on(
      t.orgId,
      t.clientPhotoId,
    ),
    /** List + orphan GC: pending_* older than TTL, caseload photo lists. */
    orgStatusCreatedIdx: index('wound_photos_org_status_created_idx').on(
      t.orgId,
      t.status,
      t.createdAt,
    ),
  }),
);

/**
 * Encrypted annotation side-cars. No plaintext payload_json in MVP —
 * vector stroke JSON and overlay PNGs are always client-encrypted blobs.
 */
export const photoAnnotations = pgTable(
  'photo_annotations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    woundPhotoId: uuid('wound_photo_id')
      .notNull()
      .references(() => woundPhotos.id),
    clientAnnotationId: text('client_annotation_id').notNull(),
    annotationType: annotationTypeEnum('annotation_type').notNull(),
    status: annotationStatusEnum('status').notNull().default('pending_upload'),
    storageKey: text('storage_key'),
    wrappedDek: bytea('wrapped_dek'),
    kekKeyId: text('kek_key_id'),
    cipherSha256: char('cipher_sha256', { length: 64 }),
    byteSize: integer('byte_size'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    orgClientAnnotationIdx: uniqueIndex('photo_annotations_org_client_annotation_uidx').on(
      t.orgId,
      t.clientAnnotationId,
    ),
    /** List + orphan GC for pending annotation uploads. */
    orgStatusCreatedIdx: index('photo_annotations_org_status_created_idx').on(
      t.orgId,
      t.status,
      t.createdAt,
    ),
  }),
);

export const clinicalTasks = pgTable('clinical_tasks', {
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
  woundPhotoId: uuid('wound_photo_id').references(() => woundPhotos.id),
  taskType: clinicalTaskTypeEnum('task_type').notNull(),
  status: clinicalTaskStatusEnum('status').notNull().default('open'),
  priority: clinicalTaskPriorityEnum('priority').notNull().default('routine'),
  title: text('title').notNull(),
  details: text('details'),
  assigneeUserId: uuid('assignee_user_id').references(() => users.id),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
