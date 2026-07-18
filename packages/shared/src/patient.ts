import { z } from 'zod';
import {
  AddressType,
  CapacityStatus,
  ContactType,
  HistoryCategory,
  LegalAuthority,
  PatientStatus,
  PayerType,
  VerificationStatus,
} from './enums';

export const CreatePatientSchema = z.object({
  firstName: z.string().min(1).max(100),
  middleName: z.string().max(100).optional(),
  lastName: z.string().min(1).max(100),
  preferredName: z.string().max(100).optional(),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sexAtBirth: z.enum(['female', 'male', 'unknown', 'other']).optional(),
  preferredLanguage: z.string().max(20).default('en'),
  interpreterNeeded: z.boolean().optional(),
  capacityStatus: z.enum(CapacityStatus).optional(),
  /** Full SSN digits only — stored encrypted; never returned */
  ssn: z
    .string()
    .regex(/^\d{9}$/, 'SSN must be 9 digits')
    .optional(),
  serviceAddress: z
    .object({
      line1: z.string().min(1).max(200),
      line2: z.string().max(200).optional(),
      city: z.string().min(1).max(100),
      state: z.string().length(2),
      postalCode: z.string().min(5).max(15),
      county: z.string().max(100).optional(),
      ruralFlag: z.boolean().optional(),
    })
    .optional(),
});

export type CreatePatientInput = z.infer<typeof CreatePatientSchema>;

export const UpdatePatientSchema = CreatePatientSchema.partial().extend({
  status: z.enum(PatientStatus).optional(),
  maritalStatus: z.string().max(50).optional(),
  advancedDirectiveOnFile: z.boolean().optional(),
});

export type UpdatePatientInput = z.infer<typeof UpdatePatientSchema>;

export const PatientAddressSchema = z.object({
  type: z.enum(AddressType),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional().nullable(),
  city: z.string().min(1).max(100),
  state: z.string().length(2),
  postalCode: z.string().min(5).max(15),
  county: z.string().max(100).optional().nullable(),
  ruralFlag: z.boolean().optional(),
});

export type PatientAddressInput = z.infer<typeof PatientAddressSchema>;

export const PutPatientAddressesSchema = z.object({
  addresses: z.array(PatientAddressSchema).min(1),
});

export type PutPatientAddressesInput = z.infer<typeof PutPatientAddressesSchema>;

export const PatientContactSchema = z.object({
  type: z.enum(ContactType),
  fullName: z.string().min(1).max(200),
  relationship: z.string().max(100).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().email().max(200).optional().nullable(),
  legalAuthority: z.enum(LegalAuthority).optional(),
});

export type PatientContactInput = z.infer<typeof PatientContactSchema>;

export const PutPatientContactsSchema = z.object({
  contacts: z.array(PatientContactSchema),
});

export type PutPatientContactsInput = z.infer<typeof PutPatientContactsSchema>;

export const CreateClinicalHistorySchema = z.object({
  category: z.enum(HistoryCategory),
  codeSystem: z.string().max(50).optional(),
  code: z.string().max(50).optional(),
  displayText: z.string().min(1).max(500),
  onsetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  active: z.boolean().optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export type CreateClinicalHistoryInput = z.infer<typeof CreateClinicalHistorySchema>;

export const CreateCoverageSchema = z.object({
  rank: z.number().int().min(1).max(10).default(1),
  payerType: z.enum(PayerType),
  payerName: z.string().min(1).max(200),
  /** Full member id — stored encrypted; never returned */
  memberId: z.string().min(1).max(50).optional(),
  groupNumber: z.string().max(50).optional().nullable(),
  subscriberName: z.string().max(200).optional().nullable(),
  relationshipToSubscriber: z.string().max(50).optional().nullable(),
  effectiveFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  effectiveTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  dualEligible: z.boolean().optional(),
});

export type CreateCoverageInput = z.infer<typeof CreateCoverageSchema>;

export const VerifyCoverageSchema = z.object({
  verificationStatus: z.enum(VerificationStatus),
});

export type VerifyCoverageInput = z.infer<typeof VerifyCoverageSchema>;
