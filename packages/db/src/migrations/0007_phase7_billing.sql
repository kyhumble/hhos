CREATE TYPE "public"."billing_claim_type" AS ENUM('hh_rap', 'hh_final', 'hospice_noe', 'hospice_claim', 'other');--> statement-breakpoint
CREATE TYPE "public"."billing_claim_status" AS ENUM('draft', 'ready', 'blocked', 'exported', 'submitted_external', 'void');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_claim_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"episode_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"claim_type" "billing_claim_type" NOT NULL,
	"status" "billing_claim_status" DEFAULT 'draft' NOT NULL,
	"service_from" date,
	"service_to" date,
	"notes" text,
	"gaps_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"readiness_snapshot_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"hard_gap_count" integer DEFAULT 0 NOT NULL,
	"export_format" text,
	"export_payload_json" jsonb,
	"exported_at" timestamp with time zone,
	"exported_by" uuid,
	"external_ref" text,
	"submitted_at" timestamp with time zone,
	"submitted_by" uuid,
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "billing_claim_packages" ADD CONSTRAINT "billing_claim_packages_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "billing_claim_packages" ADD CONSTRAINT "billing_claim_packages_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "billing_claim_packages" ADD CONSTRAINT "billing_claim_packages_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "billing_claim_packages" ADD CONSTRAINT "billing_claim_packages_exported_by_users_id_fk" FOREIGN KEY ("exported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "billing_claim_packages" ADD CONSTRAINT "billing_claim_packages_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "billing_claim_packages" ADD CONSTRAINT "billing_claim_packages_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "billing_claim_packages" ADD CONSTRAINT "billing_claim_packages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_claim_packages_org_status_idx" ON "billing_claim_packages" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_claim_packages_episode_idx" ON "billing_claim_packages" USING btree ("episode_id");
