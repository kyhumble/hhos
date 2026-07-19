CREATE TYPE "public"."oasis_timepoint" AS ENUM('SOC', 'ROC', 'FU', 'RECERT', 'TRANS', 'DEATH', 'DISCH');--> statement-breakpoint
CREATE TYPE "public"."oasis_assessment_status" AS ENUM('draft', 'in_review', 'locked', 'void');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "oasis_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"episode_id" uuid NOT NULL,
	"timepoint" "oasis_timepoint" DEFAULT 'SOC' NOT NULL,
	"item_set_version" text NOT NULL,
	"status" "oasis_assessment_status" DEFAULT 'draft' NOT NULL,
	"assessment_date" date,
	"flags_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"gaps_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pdgm_hint_json" jsonb,
	"completeness_score" integer DEFAULT 0 NOT NULL,
	"submitted_at" timestamp with time zone,
	"submitted_by" uuid,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"locked_at" timestamp with time zone,
	"locked_by" uuid,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "oasis_item_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"assessment_id" uuid NOT NULL,
	"item_id" text NOT NULL,
	"item_code" text NOT NULL,
	"value_json" jsonb,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answered_by" uuid
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oasis_assessments" ADD CONSTRAINT "oasis_assessments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oasis_assessments" ADD CONSTRAINT "oasis_assessments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oasis_assessments" ADD CONSTRAINT "oasis_assessments_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oasis_assessments" ADD CONSTRAINT "oasis_assessments_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oasis_assessments" ADD CONSTRAINT "oasis_assessments_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oasis_assessments" ADD CONSTRAINT "oasis_assessments_locked_by_users_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oasis_assessments" ADD CONSTRAINT "oasis_assessments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oasis_assessments" ADD CONSTRAINT "oasis_assessments_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oasis_item_responses" ADD CONSTRAINT "oasis_item_responses_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oasis_item_responses" ADD CONSTRAINT "oasis_item_responses_assessment_id_oasis_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."oasis_assessments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oasis_item_responses" ADD CONSTRAINT "oasis_item_responses_answered_by_users_id_fk" FOREIGN KEY ("answered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oasis_assessments_episode_timepoint_idx" ON "oasis_assessments" USING btree ("episode_id","timepoint");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oasis_assessments_org_status_idx" ON "oasis_assessments" USING btree ("org_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "oasis_item_responses_assessment_item_uidx" ON "oasis_item_responses" USING btree ("assessment_id","item_id");
