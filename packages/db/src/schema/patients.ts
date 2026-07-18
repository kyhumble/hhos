import {
  boolean,
  char,
  customType,
  date,
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
import { users } from './users';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

export const patientStatusEnum = pgEnum('patient_status', [
  'prospect',
  'active',
  'discharged',
  'non_admit',
]);

export const capacityStatusEnum = pgEnum('capacity_status', [
  'assumed_capacity',
  'impaired',
  'unknown',
]);

export const sexAtBirthEnum = pgEnum('sex_at_birth', ['female', 'male', 'unknown', 'other']);

export const addressTypeEnum = pgEnum('address_type', ['service', 'mailing', 'prior']);

export const contactTypeEnum = pgEnum('contact_type', [
  'emergency',
  'surrogate',
  'caregiver',
  'other',
]);

export const legalAuthorityEnum = pgEnum('legal_authority', [
  'none',
  'poa_healthcare',
  'guardian',
  'parent',
  'unknown',
]);

export const payerTypeEnum = pgEnum('payer_type', [
  'medicare_ff',
  'medicare_advantage',
  'medicaid',
  'commercial',
  'self_pay',
  'other',
]);

export const verificationStatusEnum = pgEnum('verification_status', [
  'unverified',
  'pending',
  'active',
  'inactive',
  'denied',
]);

export const historyCategoryEnum = pgEnum('history_category', [
  'allergy',
  'medication',
  'condition',
  'surgery',
  'hospitalization',
  'social',
  'other',
]);

export const patientFlagCodeEnum = pgEnum('patient_flag_code', [
  'language_barrier',
  'behavioral_health',
  'infection_control',
  'expedited_admit',
  'high_travel',
  'dual_eligible',
  'capacity_concern',
]);

export const patients = pgTable(
  'patients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    mrn: text('mrn').notNull(),
    firstName: text('first_name').notNull(),
    middleName: text('middle_name'),
    lastName: text('last_name').notNull(),
    preferredName: text('preferred_name'),
    dob: date('dob').notNull(),
    sexAtBirth: sexAtBirthEnum('sex_at_birth'),
    genderIdentity: text('gender_identity'),
    encryptedSsn: bytea('encrypted_ssn'),
    ssnLast4: char('ssn_last4', { length: 4 }),
    preferredLanguage: text('preferred_language').notNull().default('en'),
    interpreterNeeded: boolean('interpreter_needed').notNull().default(false),
    maritalStatus: text('marital_status'),
    advancedDirectiveOnFile: boolean('advanced_directive_on_file'),
    capacityStatus: capacityStatusEnum('capacity_status')
      .notNull()
      .default('assumed_capacity'),
    deceasedAt: timestamp('deceased_at', { withTimezone: true }),
    status: patientStatusEnum('status').notNull().default('prospect'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id),
    updatedBy: uuid('updated_by').references(() => users.id),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    orgMrnIdx: uniqueIndex('patients_org_mrn_uidx').on(t.orgId, t.mrn),
  }),
);

export const patientAddresses = pgTable('patient_addresses', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id),
  patientId: uuid('patient_id')
    .notNull()
    .references(() => patients.id),
  type: addressTypeEnum('type').notNull(),
  line1: text('line1').notNull(),
  line2: text('line2'),
  city: text('city').notNull(),
  state: text('state').notNull(),
  postalCode: text('postal_code').notNull(),
  county: text('county'),
  geoLat: doublePrecision('geo_lat'),
  geoLng: doublePrecision('geo_lng'),
  ruralFlag: boolean('rural_flag').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const patientContacts = pgTable('patient_contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id),
  patientId: uuid('patient_id')
    .notNull()
    .references(() => patients.id),
  type: contactTypeEnum('type').notNull(),
  fullName: text('full_name').notNull(),
  relationship: text('relationship'),
  phone: text('phone'),
  email: text('email'),
  legalAuthority: legalAuthorityEnum('legal_authority').notNull().default('none'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const coverages = pgTable('coverages', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id),
  patientId: uuid('patient_id')
    .notNull()
    .references(() => patients.id),
  rank: integer('rank').notNull().default(1),
  payerType: payerTypeEnum('payer_type').notNull(),
  payerName: text('payer_name').notNull(),
  memberIdEncrypted: bytea('member_id_encrypted'),
  memberIdLast4: char('member_id_last4', { length: 4 }),
  groupNumber: text('group_number'),
  subscriberName: text('subscriber_name'),
  relationshipToSubscriber: text('relationship_to_subscriber'),
  effectiveFrom: date('effective_from'),
  effectiveTo: date('effective_to'),
  dualEligible: boolean('dual_eligible').notNull().default(false),
  verificationStatus: verificationStatusEnum('verification_status')
    .notNull()
    .default('unverified'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  verifiedBy: uuid('verified_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const clinicalHistoryItems = pgTable('clinical_history_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id),
  patientId: uuid('patient_id')
    .notNull()
    .references(() => patients.id),
  category: historyCategoryEnum('category').notNull(),
  codeSystem: text('code_system'),
  code: text('code'),
  displayText: text('display_text').notNull(),
  onsetDate: date('onset_date'),
  active: boolean('active').notNull().default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const patientFlags = pgTable('patient_flags', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id),
  patientId: uuid('patient_id')
    .notNull()
    .references(() => patients.id),
  code: patientFlagCodeEnum('code').notNull(),
  notes: text('notes'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
});
