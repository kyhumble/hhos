ALTER TYPE "public"."care_type" ADD VALUE IF NOT EXISTS 'hospice';--> statement-breakpoint
CREATE TYPE "public"."hospice_election_status" AS ENUM('draft', 'active', 'revoked', 'discharged', 'transferred');--> statement-breakpoint
CREATE TYPE "public"."hospice_level_of_care" AS ENUM('routine', 'continuous', 'respite', 'gip');--> statement-breakpoint
CREATE TYPE "public"."hospice_benefit_period_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."hospice_place_of_service" AS ENUM('home', 'snf', 'assisted_living', 'inpatient', 'other');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hospice_elections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"episode_id" uuid NOT NULL,
	"status" "hospice_election_status" DEFAULT 'draft' NOT NULL,
	"election_date" date NOT NULL,
	"effective_date" date NOT NULL,
	"attending_physician_name" text NOT NULL,
	"attending_physician_npi" text,
	"certifying_physician_name" text,
	"certifying_physician_npi" text,
	"terminal_dx_icd10" text,
	"terminal_dx_text" text,
	"place_of_service" "hospice_place_of_service" DEFAULT 'home' NOT NULL,
	"notes" text,
	"activated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoke_reason" text,
	"latest_cert_package_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hospice_benefit_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"election_id" uuid NOT NULL,
	"episode_id" uuid NOT NULL,
	"period_number" integer NOT NULL,
	"status" "hospice_benefit_period_status" DEFAULT 'open' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hospice_loc_stays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"election_id" uuid NOT NULL,
	"episode_id" uuid NOT NULL,
	"level_of_care" "hospice_level_of_care" NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"reason" text,
	"facility_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "hospice_elections" ADD CONSTRAINT "hospice_elections_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "hospice_elections" ADD CONSTRAINT "hospice_elections_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "hospice_elections" ADD CONSTRAINT "hospice_elections_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "hospice_elections" ADD CONSTRAINT "hospice_elections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "hospice_elections" ADD CONSTRAINT "hospice_elections_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "hospice_benefit_periods" ADD CONSTRAINT "hospice_benefit_periods_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "hospice_benefit_periods" ADD CONSTRAINT "hospice_benefit_periods_election_id_hospice_elections_id_fk" FOREIGN KEY ("election_id") REFERENCES "public"."hospice_elections"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "hospice_benefit_periods" ADD CONSTRAINT "hospice_benefit_periods_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "hospice_loc_stays" ADD CONSTRAINT "hospice_loc_stays_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "hospice_loc_stays" ADD CONSTRAINT "hospice_loc_stays_election_id_hospice_elections_id_fk" FOREIGN KEY ("election_id") REFERENCES "public"."hospice_elections"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "hospice_loc_stays" ADD CONSTRAINT "hospice_loc_stays_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "hospice_loc_stays" ADD CONSTRAINT "hospice_loc_stays_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hospice_elections_org_status_idx" ON "hospice_elections" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hospice_elections_patient_idx" ON "hospice_elections" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hospice_elections_episode_idx" ON "hospice_elections" USING btree ("episode_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hospice_benefit_periods_election_idx" ON "hospice_benefit_periods" USING btree ("election_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hospice_loc_stays_election_idx" ON "hospice_loc_stays" USING btree ("election_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hospice_loc_stays_open_idx" ON "hospice_loc_stays" USING btree ("election_id","ended_at");
