/** Shared domain enums for HHOS Phase 0/1 */

export const UserStatus = ['active', 'disabled', 'invited'] as const;
export type UserStatus = (typeof UserStatus)[number];

export const RoleCode = [
  'field_rn',
  'intake_coordinator',
  'clinical_lead',
  'billing',
  'compliance',
  'admin',
] as const;
export type RoleCode = (typeof RoleCode)[number];

export const PatientStatus = ['prospect', 'active', 'discharged', 'non_admit'] as const;
export type PatientStatus = (typeof PatientStatus)[number];

export const CapacityStatus = ['assumed_capacity', 'impaired', 'unknown'] as const;
export type CapacityStatus = (typeof CapacityStatus)[number];

export const AddressType = ['service', 'mailing', 'prior'] as const;
export type AddressType = (typeof AddressType)[number];

export const ContactType = ['emergency', 'surrogate', 'caregiver', 'other'] as const;
export type ContactType = (typeof ContactType)[number];

export const LegalAuthority = [
  'none',
  'poa_healthcare',
  'guardian',
  'parent',
  'unknown',
] as const;
export type LegalAuthority = (typeof LegalAuthority)[number];

export const PayerType = [
  'medicare_ff',
  'medicare_advantage',
  'medicaid',
  'commercial',
  'self_pay',
  'other',
] as const;
export type PayerType = (typeof PayerType)[number];

export const VerificationStatus = [
  'unverified',
  'pending',
  'active',
  'inactive',
  'denied',
] as const;
export type VerificationStatus = (typeof VerificationStatus)[number];

export const HistoryCategory = [
  'allergy',
  'medication',
  'condition',
  'surgery',
  'hospitalization',
  'social',
  'other',
] as const;
export type HistoryCategory = (typeof HistoryCategory)[number];

export const PatientFlagCode = [
  'language_barrier',
  'behavioral_health',
  'infection_control',
  'expedited_admit',
  'high_travel',
  'dual_eligible',
  'capacity_concern',
] as const;
export type PatientFlagCode = (typeof PatientFlagCode)[number];

export const ReferralSourceType = ['hospital', 'physician', 'snf', 'self', 'other'] as const;
export type ReferralSourceType = (typeof ReferralSourceType)[number];

export const ReferralStatus = [
  'new',
  'in_review',
  'accepted',
  'declined',
  'converted',
  'cancelled',
] as const;
export type ReferralStatus = (typeof ReferralStatus)[number];

export const ReferralAcuity = ['routine', 'urgent', 'expedited'] as const;
export type ReferralAcuity = (typeof ReferralAcuity)[number];

export const EpisodeStatus = [
  'pre_admit',
  'scheduled_soc',
  'active',
  'hold',
  'discharged',
  'non_admit',
] as const;
export type EpisodeStatus = (typeof EpisodeStatus)[number];

export const CareType = ['home_health', 'wound_only', 'other'] as const;
export type CareType = (typeof CareType)[number];

export const F2fStatus = ['unknown', 'scheduled', 'completed', 'missing', 'waived_review'] as const;
export type F2fStatus = (typeof F2fStatus)[number];

export const OrdersStatus = ['missing', 'verbal', 'signed', 'expired'] as const;
export type OrdersStatus = (typeof OrdersStatus)[number];

export const PocStatus = ['not_started', 'draft', 'pending_signature', 'signed'] as const;
export type PocStatus = (typeof PocStatus)[number];

export const IntakeStatus = ['incomplete', 'ready_for_soc', 'complete'] as const;
export type IntakeStatus = (typeof IntakeStatus)[number];

export const CareTeamRole = ['primary_rn', 'covering_rn', 'intake', 'clinical_lead'] as const;
export type CareTeamRole = (typeof CareTeamRole)[number];

export const ConsentType = [
  'HIPAA_NPP',
  'ADMISSION',
  'WOUND_PHOTO',
  'ROI',
  'FINANCIAL',
  'TELEHEALTH',
  'RESEARCH',
] as const;
export type ConsentType = (typeof ConsentType)[number];

export const ConsentTemplateStatus = ['draft', 'active', 'retired'] as const;
export type ConsentTemplateStatus = (typeof ConsentTemplateStatus)[number];

export const ConsentRecordStatus = ['draft', 'signed', 'revoked', 'expired', 'void'] as const;
export type ConsentRecordStatus = (typeof ConsentRecordStatus)[number];

export const ConsentCaptureMethod = [
  'onscreen',
  'wet_ink_scan',
  'verbal_with_witness',
  'phone',
] as const;
export type ConsentCaptureMethod = (typeof ConsentCaptureMethod)[number];

export const SignerType = ['patient', 'surrogate'] as const;
export type SignerType = (typeof SignerType)[number];

export const PurposeCode = [
  'TREATMENT',
  'PAYMENT',
  'HOPS',
  'WOUND_PHOTO_CLINICAL',
  'WOUND_PHOTO_QA',
  'WOUND_PHOTO_TEACHING',
  'SHARE_PHYSICIAN',
  'SHARE_PAYER',
  'MARKETING',
] as const;
export type PurposeCode = (typeof PurposeCode)[number];

export const ChecklistCode = [
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
] as const;
export type ChecklistCode = (typeof ChecklistCode)[number];

export const ChecklistItemStatus = ['pending', 'complete', 'waived', 'blocked'] as const;
export type ChecklistItemStatus = (typeof ChecklistItemStatus)[number];

export const EpisodeFlag = [
  'SOC_DUE_SOON',
  'SOC_OVERDUE',
  'INTAKE_INCOMPLETE',
  'F2F_MISSING',
  'ORDERS_MISSING',
  'CONSENT_GAP',
  'COVERAGE_UNVERIFIED',
] as const;
export type EpisodeFlag = (typeof EpisodeFlag)[number];

/** Default SOC due window from referral received_at (hours). Compliance must approve prod. */
export const DEFAULT_SOC_DUE_HOURS = 48;
