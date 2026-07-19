/** Shared domain enums for HHOS Phase 0–3 */

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

export const CareType = ['home_health', 'wound_only', 'hospice', 'other'] as const;
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

// ─── Phase 2: wounds, visits, photos, devices, clinical tasks ───────────────

export const WoundLaterality = [
  'left',
  'right',
  'bilateral',
  'midline',
  'na',
] as const;
export type WoundLaterality = (typeof WoundLaterality)[number];

export const WoundStatus = ['active', 'healed', 'transferred', 'void'] as const;
export type WoundStatus = (typeof WoundStatus)[number];

/** Controlled wound-type list (shared); free-text not allowed on create. */
export const WoundType = [
  'pressure_injury',
  'venous_ulcer',
  'arterial_ulcer',
  'diabetic_ulcer',
  'surgical',
  'traumatic',
  'burn',
  'other',
] as const;
export type WoundType = (typeof WoundType)[number];

export const VisitType = ['soc', 'routine', 'prn', 'other'] as const;
export type VisitType = (typeof VisitType)[number];

export const VisitStatus = ['in_progress', 'completed', 'cancelled'] as const;
export type VisitStatus = (typeof VisitStatus)[number];

export const WoundPhotoStatus = [
  'pending_upload',
  'pending_put',
  'available',
  'failed',
  'abandoned',
  'soft_deleted',
] as const;
export type WoundPhotoStatus = (typeof WoundPhotoStatus)[number];

/** Clinical capture source — gallery import is never allowed (AGENTS.md). */
export const CaptureSource = ['app_camera'] as const;
export type CaptureSource = (typeof CaptureSource)[number];

export const MeasurementMethod = [
  'manual_ruler',
  'app_overlay',
  'unknown',
] as const;
export type MeasurementMethod = (typeof MeasurementMethod)[number];

export const AnnotationType = ['vector_json', 'overlay_png'] as const;
export type AnnotationType = (typeof AnnotationType)[number];

/** Annotation object lifecycle mirrors photo pending/available pattern. */
export const AnnotationStatus = [
  'pending_upload',
  'pending_put',
  'available',
  'failed',
  'abandoned',
  'soft_deleted',
] as const;
export type AnnotationStatus = (typeof AnnotationStatus)[number];

export const ClinicalTaskType = [
  'large_wound_review',
  'photo_qa',
  'other',
] as const;
export type ClinicalTaskType = (typeof ClinicalTaskType)[number];

export const ClinicalTaskStatus = [
  'open',
  'in_progress',
  'done',
  'cancelled',
] as const;
export type ClinicalTaskStatus = (typeof ClinicalTaskStatus)[number];

export const ClinicalTaskPriority = ['routine', 'urgent'] as const;
export type ClinicalTaskPriority = (typeof ClinicalTaskPriority)[number];

export const DevicePlatform = ['ios', 'android'] as const;
export type DevicePlatform = (typeof DevicePlatform)[number];

export const DeviceStatus = ['active', 'revoked'] as const;
export type DeviceStatus = (typeof DeviceStatus)[number];

// ─── Phase 3: OASIS-E2 / PDGM ───────────────────────────────────────────────

export const OasisTimepoint = [
  'SOC',
  'ROC',
  'FU',
  'RECERT',
  'TRANS',
  'DEATH',
  'DISCH',
] as const;
export type OasisTimepoint = (typeof OasisTimepoint)[number];

export const OasisAssessmentStatus = [
  'draft',
  'in_review',
  'locked',
  'void',
] as const;
export type OasisAssessmentStatus = (typeof OasisAssessmentStatus)[number];

export const OasisFlagCode = [
  'MISSING_PRIMARY_DX',
  'THIN_FUNCTIONAL',
  'SKIN_INCOMPLETE',
  'COMORBIDITY_SPARSE',
  'ADMISSION_SOURCE_UNKNOWN',
  'LUPA_RISK',
  'DOC_GAP',
  'TIMELINESS_WARN',
] as const;
export type OasisFlagCode = (typeof OasisFlagCode)[number];

/** Pin before production; re-validate against CMS OASIS-E2. */
export const OASIS_ITEM_SET_VERSION = 'oasis-e2-2026.04-subset-v1' as const;

/** Default advisory LUPA visit threshold (not full HIPPS grouper). */
export const DEFAULT_LUPA_VISIT_THRESHOLD = 4;

// ─── Phase 4: routing / Service AI / field ops ──────────────────────────────

export const ClinicianSkill = [
  'wound_care',
  'ostomy',
  'iv_therapy',
  'behavioral_health',
  'pediatric',
  'bilingual_es',
  'rural_travel',
] as const;
export type ClinicianSkill = (typeof ClinicianSkill)[number];

export const RouteSuggestionStatus = [
  'pending',
  'accepted',
  'rejected',
  'superseded',
  'expired',
] as const;
export type RouteSuggestionStatus = (typeof RouteSuggestionStatus)[number];

export const RouteDecisionReason = [
  'best_match',
  'geography',
  'skills',
  'language',
  'caseload',
  'patient_request',
  'clinical_judgment',
  'capacity',
  'other',
] as const;
export type RouteDecisionReason = (typeof RouteDecisionReason)[number];

export const VisitTaskType = [
  'soc_visit',
  'skilled_visit',
  'wound_reassessment',
  'oasis_followup',
  'supply_drop',
  'hospitalization_followup',
  'other',
] as const;
export type VisitTaskType = (typeof VisitTaskType)[number];

export const VisitTaskStatus = [
  'open',
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
] as const;
export type VisitTaskStatus = (typeof VisitTaskStatus)[number];

export const HospitalizationAlertStatus = [
  'new',
  'acknowledged',
  'in_progress',
  'resolved',
  'false_positive',
] as const;
export type HospitalizationAlertStatus = (typeof HospitalizationAlertStatus)[number];

// ─── Phase 5: orders / 485 / physician e-sign ───────────────────────────────

/** Clinical document types that require physician (or NPP) signature. */
export const OrderDocType = [
  'plan_of_care_485',
  'physician_order',
  'verbal_order',
  'f2f_encounter',
  'hospice_cert',
  'hospice_recert',
  'other',
] as const;
export type OrderDocType = (typeof OrderDocType)[number];

export const OrderPackageStatus = [
  'draft',
  'ready',
  'sent',
  'viewed',
  'signed',
  'rejected',
  'expired',
  'void',
] as const;
export type OrderPackageStatus = (typeof OrderPackageStatus)[number];

export const SignatureRequestStatus = [
  'pending',
  'viewed',
  'signed',
  'rejected',
  'expired',
  'revoked',
] as const;
export type SignatureRequestStatus = (typeof SignatureRequestStatus)[number];

export const SignatureMethod = [
  'esign_portal',
  'wet_ink_scan',
  'external_attested',
] as const;
export type SignatureMethod = (typeof SignatureMethod)[number];

// ─── Phase 6: hospice ───────────────────────────────────────────────────────

export const HospiceElectionStatus = [
  'draft',
  'active',
  'revoked',
  'discharged',
  'transferred',
] as const;
export type HospiceElectionStatus = (typeof HospiceElectionStatus)[number];

/** Medicare hospice levels of care. */
export const HospiceLevelOfCare = [
  'routine',
  'continuous',
  'respite',
  'gip',
] as const;
export type HospiceLevelOfCare = (typeof HospiceLevelOfCare)[number];

export const HospiceBenefitPeriodStatus = ['open', 'closed'] as const;
export type HospiceBenefitPeriodStatus = (typeof HospiceBenefitPeriodStatus)[number];
