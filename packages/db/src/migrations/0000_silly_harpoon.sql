CREATE TYPE "public"."role_code" AS ENUM('field_rn', 'intake_coordinator', 'clinical_lead', 'billing', 'compliance', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'disabled', 'invited');--> statement-breakpoint
CREATE TYPE "public"."address_type" AS ENUM('service', 'mailing', 'prior');--> statement-breakpoint
CREATE TYPE "public"."capacity_status" AS ENUM('assumed_capacity', 'impaired', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."contact_type" AS ENUM('emergency', 'surrogate', 'caregiver', 'other');--> statement-breakpoint
CREATE TYPE "public"."history_category" AS ENUM('allergy', 'medication', 'condition', 'surgery', 'hospitalization', 'social', 'other');--> statement-breakpoint
CREATE TYPE "public"."legal_authority" AS ENUM('none', 'poa_healthcare', 'guardian', 'parent', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."patient_flag_code" AS ENUM('language_barrier', 'behavioral_health', 'infection_control', 'expedited_admit', 'high_travel', 'dual_eligible', 'capacity_concern');--> statement-breakpoint
CREATE TYPE "public"."patient_status" AS ENUM('prospect', 'active', 'discharged', 'non_admit');--> statement-breakpoint
CREATE TYPE "public"."payer_type" AS ENUM('medicare_ff', 'medicare_advantage', 'medicaid', 'commercial', 'self_pay', 'other');--> statement-breakpoint
CREATE TYPE "public"."sex_at_birth" AS ENUM('female', 'male', 'unknown', 'other');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('unverified', 'pending', 'active', 'inactive', 'denied');--> statement-breakpoint
CREATE TYPE "public"."referral_acuity" AS ENUM('routine', 'urgent', 'expedited');--> statement-breakpoint
CREATE TYPE "public"."referral_source_type" AS ENUM('hospital', 'physician', 'snf', 'self', 'other');--> statement-breakpoint
CREATE TYPE "public"."referral_status" AS ENUM('new', 'in_review', 'accepted', 'declined', 'converted', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."care_team_role" AS ENUM('primary_rn', 'covering_rn', 'intake', 'clinical_lead');--> statement-breakpoint
CREATE TYPE "public"."care_type" AS ENUM('home_health', 'wound_only', 'other');--> statement-breakpoint
CREATE TYPE "public"."checklist_code" AS ENUM('DEMOGRAPHICS_COMPLETE', 'SERVICE_ADDRESS', 'PRIMARY_COVERAGE', 'COVERAGE_VERIFIED', 'NPP_ACK', 'ADMISSION_CONSENT', 'PHOTO_CONSENT', 'ROI', 'FINANCIAL', 'F2F_STATUS_KNOWN', 'ORDERS_STATUS_KNOWN', 'PRIMARY_DX_PRESENT', 'HISTORY_STARTED', 'SURROGATE_DOCUMENTED');--> statement-breakpoint
CREATE TYPE "public"."checklist_item_status" AS ENUM('pending', 'complete', 'waived', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."episode_status" AS ENUM('pre_admit', 'scheduled_soc', 'active', 'hold', 'discharged', 'non_admit');--> statement-breakpoint
CREATE TYPE "public"."f2f_status" AS ENUM('unknown', 'scheduled', 'completed', 'missing', 'waived_review');--> statement-breakpoint
CREATE TYPE "public"."intake_status" AS ENUM('incomplete', 'ready_for_soc', 'complete');--> statement-breakpoint
CREATE TYPE "public"."order_type" AS ENUM('f2f', 'plan_of_care', 'verbal_order', 'supply', 'other');--> statement-breakpoint
CREATE TYPE "public"."orders_status" AS ENUM('missing', 'verbal', 'signed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."poc_status" AS ENUM('not_started', 'draft', 'pending_signature', 'signed');--> statement-breakpoint
CREATE TYPE "public"."timeline_event_type" AS ENUM('referral_received', 'intake_started', 'consent_captured', 'soc_scheduled', 'soc_completed', 'flag_raised', 'owner_changed', 'episode_accepted');--> statement-breakpoint
CREATE TYPE "public"."consent_capture_method" AS ENUM('onscreen', 'wet_ink_scan', 'verbal_with_witness', 'phone');--> statement-breakpoint
CREATE TYPE "public"."consent_record_status" AS ENUM('draft', 'signed', 'revoked', 'expired', 'void');--> statement-breakpoint
CREATE TYPE "public"."consent_template_status" AS ENUM('draft', 'active', 'retired');--> statement-breakpoint
CREATE TYPE "public"."consent_type" AS ENUM('HIPAA_NPP', 'ADMISSION', 'WOUND_PHOTO', 'ROI', 'FINANCIAL', 'TELEHEALTH', 'RESEARCH');--> statement-breakpoint
CREATE TYPE "public"."purpose_code" AS ENUM('TREATMENT', 'PAYMENT', 'HOPS', 'WOUND_PHOTO_CLINICAL', 'WOUND_PHOTO_QA', 'WOUND_PHOTO_TEACHING', 'SHARE_PHYSICIAN', 'SHARE_PAYER', 'MARKETING');--> statement-breakpoint
CREATE TYPE "public"."revoked_by_party" AS ENUM('patient', 'surrogate', 'org');--> statement-breakpoint
CREATE TYPE "public"."signature_type" AS ENUM('drawn', 'typed', 'image_upload');--> statement-breakpoint
CREATE TYPE "public"."signer_type" AS ENUM('patient', 'surrogate');--> statement-breakpoint
CREATE TYPE "public"."audit_actor_type" AS ENUM('user', 'system', 'break_glass');--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"npi" text,
	"timezone" text DEFAULT 'America/Chicago' NOT NULL,
	"settings" jsonb DEFAULT '{"socDueHours":48,"photoGeotagEnabled":false,"coverageVerifiedRequired":false,"woundPathwayDefault":true}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"description" text,
	CONSTRAINT "permissions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"code" "role_code" NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"cognito_sub" text,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"mfa_required" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinical_history_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"category" "history_category" NOT NULL,
	"code_system" text,
	"code" text,
	"display_text" text NOT NULL,
	"onset_date" date,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "coverages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"rank" integer DEFAULT 1 NOT NULL,
	"payer_type" "payer_type" NOT NULL,
	"payer_name" text NOT NULL,
	"member_id_encrypted" "bytea",
	"member_id_last4" char(4),
	"group_number" text,
	"subscriber_name" text,
	"relationship_to_subscriber" text,
	"effective_from" date,
	"effective_to" date,
	"dual_eligible" boolean DEFAULT false NOT NULL,
	"verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"verified_at" timestamp with time zone,
	"verified_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "patient_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"type" "address_type" NOT NULL,
	"line1" text NOT NULL,
	"line2" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"postal_code" text NOT NULL,
	"county" text,
	"geo_lat" double precision,
	"geo_lng" double precision,
	"rural_flag" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "patient_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"type" "contact_type" NOT NULL,
	"full_name" text NOT NULL,
	"relationship" text,
	"phone" text,
	"email" text,
	"legal_authority" "legal_authority" DEFAULT 'none' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "patient_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"code" "patient_flag_code" NOT NULL,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"mrn" text NOT NULL,
	"first_name" text NOT NULL,
	"middle_name" text,
	"last_name" text NOT NULL,
	"preferred_name" text,
	"dob" date NOT NULL,
	"sex_at_birth" "sex_at_birth",
	"gender_identity" text,
	"encrypted_ssn" "bytea",
	"ssn_last4" char(4),
	"preferred_language" text DEFAULT 'en' NOT NULL,
	"interpreter_needed" boolean DEFAULT false NOT NULL,
	"marital_status" text,
	"advanced_directive_on_file" boolean,
	"capacity_status" "capacity_status" DEFAULT 'assumed_capacity' NOT NULL,
	"deceased_at" timestamp with time zone,
	"status" "patient_status" DEFAULT 'prospect' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"external_ref" text,
	"source_type" "referral_source_type" NOT NULL,
	"source_name" text NOT NULL,
	"source_contact" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acuity" "referral_acuity" DEFAULT 'routine',
	"reason_for_referral" text NOT NULL,
	"primary_diagnosis_text" text,
	"primary_diagnosis_icd10" text,
	"requested_services" text DEFAULT '["wound"]' NOT NULL,
	"status" "referral_status" DEFAULT 'new' NOT NULL,
	"decline_reason" text,
	"intake_owner_id" uuid,
	"completeness_score" integer DEFAULT 0 NOT NULL,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "care_team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"episode_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"team_role" "care_team_role" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assigned_by" uuid
);
--> statement-breakpoint
CREATE TABLE "clinical_documents_meta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"episode_id" uuid,
	"doc_type" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"storage_key" text NOT NULL,
	"sha256" text NOT NULL,
	"uploaded_by" uuid,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "episode_timeline_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"episode_id" uuid NOT NULL,
	"event_type" timeline_event_type NOT NULL,
	"summary" text NOT NULL,
	"metadata" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "episodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"referral_id" uuid,
	"episode_number" integer DEFAULT 1 NOT NULL,
	"care_type" "care_type" DEFAULT 'wound_only' NOT NULL,
	"status" "episode_status" DEFAULT 'pre_admit' NOT NULL,
	"referral_received_at" timestamp with time zone NOT NULL,
	"soc_due_at" timestamp with time zone,
	"soc_scheduled_at" timestamp with time zone,
	"soc_completed_at" timestamp with time zone,
	"soc_clinician_id" uuid,
	"non_admit_reason" text,
	"admission_source" text,
	"primary_dx_icd10" text,
	"f2f_status" "f2f_status" DEFAULT 'unknown' NOT NULL,
	"f2f_date" date,
	"orders_status" "orders_status" DEFAULT 'missing' NOT NULL,
	"poc_status" "poc_status" DEFAULT 'not_started' NOT NULL,
	"intake_status" "intake_status" DEFAULT 'incomplete' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "intake_checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"episode_id" uuid NOT NULL,
	"code" "checklist_code" NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"status" "checklist_item_status" DEFAULT 'pending' NOT NULL,
	"blocked_reason" text,
	"completed_at" timestamp with time zone,
	"completed_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"episode_id" uuid NOT NULL,
	"order_type" "order_type" NOT NULL,
	"status" text DEFAULT 'missing' NOT NULL,
	"ordered_at" timestamp with time zone,
	"signed_at" timestamp with time zone,
	"physician_name" text,
	"physician_npi" text,
	"document_meta_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"episode_id" uuid,
	"template_id" uuid NOT NULL,
	"template_version" integer NOT NULL,
	"template_body_sha256" char(64) NOT NULL,
	"status" "consent_record_status" DEFAULT 'draft' NOT NULL,
	"captured_at" timestamp with time zone,
	"captured_by_user_id" uuid,
	"capture_method" "consent_capture_method",
	"signer_type" "signer_type",
	"signer_name" text,
	"signer_relationship" text,
	"patient_present" boolean,
	"locale_used" text,
	"ip_address" text,
	"device_id" text,
	"geo_lat" double precision,
	"geo_lng" double precision,
	"idempotency_key" text,
	"expires_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_revocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consent_record_id" uuid NOT NULL,
	"revoked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_by_user_id" uuid,
	"revoked_by_party" "revoked_by_party" NOT NULL,
	"reason" text NOT NULL,
	"method" text
);
--> statement-breakpoint
CREATE TABLE "consent_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consent_record_id" uuid NOT NULL,
	"signature_type" "signature_type" NOT NULL,
	"signature_blob_key" text,
	"typed_name" text,
	"attested_statement" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_template_purposes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"purpose_code" "purpose_code" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"consent_type" "consent_type" NOT NULL,
	"version" integer NOT NULL,
	"title" text NOT NULL,
	"body_markdown" text NOT NULL,
	"body_sha256" char(64) NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"requires_patient_signature" boolean DEFAULT true NOT NULL,
	"allows_surrogate" boolean DEFAULT true NOT NULL,
	"is_required_for_admission" boolean DEFAULT false NOT NULL,
	"is_required_for_wound_photo" boolean DEFAULT false NOT NULL,
	"status" "consent_template_status" DEFAULT 'draft' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_user_id" uuid,
	"actor_type" "audit_actor_type" DEFAULT 'user' NOT NULL,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" uuid,
	"patient_id" uuid,
	"episode_id" uuid,
	"ip" text,
	"user_agent" text,
	"device_id" text,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"request_id" text
);
--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_history_items" ADD CONSTRAINT "clinical_history_items_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_history_items" ADD CONSTRAINT "clinical_history_items_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_history_items" ADD CONSTRAINT "clinical_history_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coverages" ADD CONSTRAINT "coverages_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coverages" ADD CONSTRAINT "coverages_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coverages" ADD CONSTRAINT "coverages_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_addresses" ADD CONSTRAINT "patient_addresses_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_addresses" ADD CONSTRAINT "patient_addresses_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_contacts" ADD CONSTRAINT "patient_contacts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_contacts" ADD CONSTRAINT "patient_contacts_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_flags" ADD CONSTRAINT "patient_flags_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_flags" ADD CONSTRAINT "patient_flags_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_flags" ADD CONSTRAINT "patient_flags_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_intake_owner_id_users_id_fk" FOREIGN KEY ("intake_owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_team_members" ADD CONSTRAINT "care_team_members_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_team_members" ADD CONSTRAINT "care_team_members_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_team_members" ADD CONSTRAINT "care_team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_team_members" ADD CONSTRAINT "care_team_members_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_documents_meta" ADD CONSTRAINT "clinical_documents_meta_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_documents_meta" ADD CONSTRAINT "clinical_documents_meta_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_documents_meta" ADD CONSTRAINT "clinical_documents_meta_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_documents_meta" ADD CONSTRAINT "clinical_documents_meta_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_timeline_events" ADD CONSTRAINT "episode_timeline_events_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_timeline_events" ADD CONSTRAINT "episode_timeline_events_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_timeline_events" ADD CONSTRAINT "episode_timeline_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_referral_id_referrals_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."referrals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_soc_clinician_id_users_id_fk" FOREIGN KEY ("soc_clinician_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_checklist_items" ADD CONSTRAINT "intake_checklist_items_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_checklist_items" ADD CONSTRAINT "intake_checklist_items_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_checklist_items" ADD CONSTRAINT "intake_checklist_items_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders_tracking" ADD CONSTRAINT "orders_tracking_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders_tracking" ADD CONSTRAINT "orders_tracking_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_template_id_consent_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."consent_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_captured_by_user_id_users_id_fk" FOREIGN KEY ("captured_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_revocations" ADD CONSTRAINT "consent_revocations_consent_record_id_consent_records_id_fk" FOREIGN KEY ("consent_record_id") REFERENCES "public"."consent_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_revocations" ADD CONSTRAINT "consent_revocations_revoked_by_user_id_users_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_signatures" ADD CONSTRAINT "consent_signatures_consent_record_id_consent_records_id_fk" FOREIGN KEY ("consent_record_id") REFERENCES "public"."consent_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_template_purposes" ADD CONSTRAINT "consent_template_purposes_template_id_consent_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."consent_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_templates" ADD CONSTRAINT "consent_templates_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_templates" ADD CONSTRAINT "consent_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "role_permissions_uidx" ON "role_permissions" USING btree ("role_id","permission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_org_code_uidx" ON "roles" USING btree ("org_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_uidx" ON "user_roles" USING btree ("user_id","role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_org_email_uidx" ON "users" USING btree ("org_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_cognito_sub_uidx" ON "users" USING btree ("cognito_sub");--> statement-breakpoint
CREATE UNIQUE INDEX "patients_org_mrn_uidx" ON "patients" USING btree ("org_id","mrn");--> statement-breakpoint
CREATE UNIQUE INDEX "referrals_idempotency_uidx" ON "referrals" USING btree ("org_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "episodes_referral_uidx" ON "episodes" USING btree ("referral_id");--> statement-breakpoint
CREATE UNIQUE INDEX "intake_checklist_episode_code_uidx" ON "intake_checklist_items" USING btree ("episode_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "consent_records_idempotency_uidx" ON "consent_records" USING btree ("org_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "consent_template_purposes_uidx" ON "consent_template_purposes" USING btree ("template_id","purpose_code");--> statement-breakpoint
CREATE UNIQUE INDEX "consent_templates_type_ver_locale_uidx" ON "consent_templates" USING btree ("org_id","consent_type","version","locale");