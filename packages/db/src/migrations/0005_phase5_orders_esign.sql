CREATE TYPE "public"."order_doc_type" AS ENUM('plan_of_care_485', 'physician_order', 'verbal_order', 'f2f_encounter', 'hospice_cert', 'hospice_recert', 'other');--> statement-breakpoint
CREATE TYPE "public"."order_package_status" AS ENUM('draft', 'ready', 'sent', 'viewed', 'signed', 'rejected', 'expired', 'void');--> statement-breakpoint
CREATE TYPE "public"."signature_request_status" AS ENUM('pending', 'viewed', 'signed', 'rejected', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."signature_method" AS ENUM('esign_portal', 'wet_ink_scan', 'external_attested');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"episode_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"doc_type" "order_doc_type" NOT NULL,
	"status" "order_package_status" DEFAULT 'draft' NOT NULL,
	"title" text NOT NULL,
	"physician_name" text NOT NULL,
	"physician_npi" text,
	"physician_email" text,
	"due_at" timestamp with time zone,
	"notes" text,
	"document_meta_id" uuid,
	"pending_storage_key" text,
	"signed_at" timestamp with time zone,
	"signed_by_name" text,
	"signature_method" "signature_method",
	"reject_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"voided_at" timestamp with time zone,
	"voided_by" uuid
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "signature_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"order_package_id" uuid NOT NULL,
	"status" "signature_request_status" DEFAULT 'pending' NOT NULL,
	"token_hash" text NOT NULL,
	"sent_to_email" text,
	"note_to_physician" text,
	"expires_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_by" uuid,
	"first_viewed_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"signer_typed_name" text,
	"signer_credentials" text,
	"signer_ip" text,
	"signer_user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "order_packages" ADD CONSTRAINT "order_packages_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "order_packages" ADD CONSTRAINT "order_packages_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "order_packages" ADD CONSTRAINT "order_packages_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "order_packages" ADD CONSTRAINT "order_packages_document_meta_id_clinical_documents_meta_id_fk" FOREIGN KEY ("document_meta_id") REFERENCES "public"."clinical_documents_meta"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "order_packages" ADD CONSTRAINT "order_packages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "order_packages" ADD CONSTRAINT "order_packages_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_order_package_id_order_packages_id_fk" FOREIGN KEY ("order_package_id") REFERENCES "public"."order_packages"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_packages_org_status_idx" ON "order_packages" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_packages_episode_idx" ON "order_packages" USING btree ("episode_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_packages_due_idx" ON "order_packages" USING btree ("org_id","due_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "signature_requests_token_hash_uidx" ON "signature_requests" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "signature_requests_package_idx" ON "signature_requests" USING btree ("order_package_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "signature_requests_org_status_idx" ON "signature_requests" USING btree ("org_id","status");
