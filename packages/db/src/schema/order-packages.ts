import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { users } from './users';
import { patients } from './patients';
import { episodes, clinicalDocumentsMeta } from './episodes';

export const orderDocTypeEnum = pgEnum('order_doc_type', [
  'plan_of_care_485',
  'physician_order',
  'verbal_order',
  'f2f_encounter',
  'hospice_cert',
  'hospice_recert',
  'other',
]);

export const orderPackageStatusEnum = pgEnum('order_package_status', [
  'draft',
  'ready',
  'sent',
  'viewed',
  'signed',
  'rejected',
  'expired',
  'void',
]);

export const signatureRequestStatusEnum = pgEnum('signature_request_status', [
  'pending',
  'viewed',
  'signed',
  'rejected',
  'expired',
  'revoked',
]);

export const signatureMethodEnum = pgEnum('signature_method', [
  'esign_portal',
  'wet_ink_scan',
  'external_attested',
]);

/**
 * Clinical order / 485 package awaiting physician (or NPP) signature.
 * PDF bytes live in object storage; metadata in clinical_documents_meta.
 */
export const orderPackages = pgTable(
  'order_packages',
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
    docType: orderDocTypeEnum('doc_type').notNull(),
    status: orderPackageStatusEnum('status').notNull().default('draft'),
    title: text('title').notNull(),
    physicianName: text('physician_name').notNull(),
    physicianNpi: text('physician_npi'),
    physicianEmail: text('physician_email'),
    dueAt: timestamp('due_at', { withTimezone: true }),
    notes: text('notes'),
    documentMetaId: uuid('document_meta_id').references(() => clinicalDocumentsMeta.id),
    /** Pending upload storage key before complete-upload. */
    pendingStorageKey: text('pending_storage_key'),
    signedAt: timestamp('signed_at', { withTimezone: true }),
    signedByName: text('signed_by_name'),
    signatureMethod: signatureMethodEnum('signature_method'),
    rejectReason: text('reject_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidedBy: uuid('voided_by').references(() => users.id),
  },
  (t) => ({
    orgStatusIdx: index('order_packages_org_status_idx').on(t.orgId, t.status),
    episodeIdx: index('order_packages_episode_idx').on(t.episodeId),
    dueIdx: index('order_packages_due_idx').on(t.orgId, t.dueAt),
  }),
);

export const signatureRequests = pgTable(
  'signature_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    orderPackageId: uuid('order_package_id')
      .notNull()
      .references(() => orderPackages.id),
    status: signatureRequestStatusEnum('status').notNull().default('pending'),
    /** SHA-256 of magic-link token (raw token never stored). */
    tokenHash: text('token_hash').notNull(),
    sentToEmail: text('sent_to_email'),
    noteToPhysician: text('note_to_physician'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
    sentBy: uuid('sent_by').references(() => users.id),
    firstViewedAt: timestamp('first_viewed_at', { withTimezone: true }),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    signerTypedName: text('signer_typed_name'),
    signerCredentials: text('signer_credentials'),
    signerIp: text('signer_ip'),
    signerUserAgent: text('signer_user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tokenUidx: uniqueIndex('signature_requests_token_hash_uidx').on(t.tokenHash),
    packageIdx: index('signature_requests_package_idx').on(t.orderPackageId),
    orgStatusIdx: index('signature_requests_org_status_idx').on(t.orgId, t.status),
  }),
);
