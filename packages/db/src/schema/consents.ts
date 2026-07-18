import {
  boolean,
  char,
  doublePrecision,
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
import { episodes } from './episodes';
import { users } from './users';

export const consentTypeEnum = pgEnum('consent_type', [
  'HIPAA_NPP',
  'ADMISSION',
  'WOUND_PHOTO',
  'ROI',
  'FINANCIAL',
  'TELEHEALTH',
  'RESEARCH',
]);

export const consentTemplateStatusEnum = pgEnum('consent_template_status', [
  'draft',
  'active',
  'retired',
]);

export const consentRecordStatusEnum = pgEnum('consent_record_status', [
  'draft',
  'signed',
  'revoked',
  'expired',
  'void',
]);

export const consentCaptureMethodEnum = pgEnum('consent_capture_method', [
  'onscreen',
  'wet_ink_scan',
  'verbal_with_witness',
  'phone',
]);

export const signerTypeEnum = pgEnum('signer_type', ['patient', 'surrogate']);

export const purposeCodeEnum = pgEnum('purpose_code', [
  'TREATMENT',
  'PAYMENT',
  'HOPS',
  'WOUND_PHOTO_CLINICAL',
  'WOUND_PHOTO_QA',
  'WOUND_PHOTO_TEACHING',
  'SHARE_PHYSICIAN',
  'SHARE_PAYER',
  'MARKETING',
]);

export const signatureTypeEnum = pgEnum('signature_type', [
  'drawn',
  'typed',
  'image_upload',
]);

export const revokedByPartyEnum = pgEnum('revoked_by_party', [
  'patient',
  'surrogate',
  'org',
]);

export const consentTemplates = pgTable(
  'consent_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    consentType: consentTypeEnum('consent_type').notNull(),
    version: integer('version').notNull(),
    title: text('title').notNull(),
    bodyMarkdown: text('body_markdown').notNull(),
    bodySha256: char('body_sha256', { length: 64 }).notNull(),
    locale: text('locale').notNull().default('en'),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
    effectiveTo: timestamp('effective_to', { withTimezone: true }),
    requiresPatientSignature: boolean('requires_patient_signature').notNull().default(true),
    allowsSurrogate: boolean('allows_surrogate').notNull().default(true),
    isRequiredForAdmission: boolean('is_required_for_admission').notNull().default(false),
    isRequiredForWoundPhoto: boolean('is_required_for_wound_photo').notNull().default(false),
    status: consentTemplateStatusEnum('status').notNull().default('draft'),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    typeVersionLocale: uniqueIndex('consent_templates_type_ver_locale_uidx').on(
      t.orgId,
      t.consentType,
      t.version,
      t.locale,
    ),
  }),
);

export const consentTemplatePurposes = pgTable(
  'consent_template_purposes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    templateId: uuid('template_id')
      .notNull()
      .references(() => consentTemplates.id),
    purposeCode: purposeCodeEnum('purpose_code').notNull(),
  },
  (t) => ({
    templatePurposeIdx: uniqueIndex('consent_template_purposes_uidx').on(
      t.templateId,
      t.purposeCode,
    ),
  }),
);

export const consentRecords = pgTable(
  'consent_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id),
    episodeId: uuid('episode_id').references(() => episodes.id),
    templateId: uuid('template_id')
      .notNull()
      .references(() => consentTemplates.id),
    templateVersion: integer('template_version').notNull(),
    templateBodySha256: char('template_body_sha256', { length: 64 }).notNull(),
    status: consentRecordStatusEnum('status').notNull().default('draft'),
    capturedAt: timestamp('captured_at', { withTimezone: true }),
    capturedByUserId: uuid('captured_by_user_id').references(() => users.id),
    captureMethod: consentCaptureMethodEnum('capture_method'),
    signerType: signerTypeEnum('signer_type'),
    signerName: text('signer_name'),
    signerRelationship: text('signer_relationship'),
    patientPresent: boolean('patient_present'),
    localeUsed: text('locale_used'),
    ipAddress: text('ip_address'),
    deviceId: text('device_id'),
    geoLat: doublePrecision('geo_lat'),
    geoLng: doublePrecision('geo_lng'),
    idempotencyKey: text('idempotency_key'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idempotencyIdx: uniqueIndex('consent_records_idempotency_uidx').on(
      t.orgId,
      t.idempotencyKey,
    ),
  }),
);

export const consentSignatures = pgTable('consent_signatures', {
  id: uuid('id').primaryKey().defaultRandom(),
  consentRecordId: uuid('consent_record_id')
    .notNull()
    .references(() => consentRecords.id),
  signatureType: signatureTypeEnum('signature_type').notNull(),
  signatureBlobKey: text('signature_blob_key'),
  typedName: text('typed_name'),
  attestedStatement: text('attested_statement'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const consentRevocations = pgTable('consent_revocations', {
  id: uuid('id').primaryKey().defaultRandom(),
  consentRecordId: uuid('consent_record_id')
    .notNull()
    .references(() => consentRecords.id),
  revokedAt: timestamp('revoked_at', { withTimezone: true }).notNull().defaultNow(),
  revokedByUserId: uuid('revoked_by_user_id').references(() => users.id),
  revokedByParty: revokedByPartyEnum('revoked_by_party').notNull(),
  reason: text('reason').notNull(),
  method: text('method'),
});
