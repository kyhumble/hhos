CREATE TYPE "public"."route_suggestion_status" AS ENUM('pending', 'accepted', 'rejected', 'superseded', 'expired');--> statement-breakpoint
CREATE TYPE "public"."visit_task_type" AS ENUM('soc_visit', 'skilled_visit', 'wound_reassessment', 'oasis_followup', 'supply_drop', 'hospitalization_followup', 'other');--> statement-breakpoint
CREATE TYPE "public"."visit_task_status" AS ENUM('open', 'scheduled', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."hospitalization_alert_status" AS ENUM('new', 'acknowledged', 'in_progress', 'resolved', 'false_positive');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clinician_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"skills_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"languages_json" jsonb DEFAULT '["en"]'::jsonb NOT NULL,
	"home_base_city" text,
	"home_base_state" text,
	"home_base_postal" text,
	"home_base_lat" double precision,
	"home_base_lng" double precision,
	"max_daily_visits" integer DEFAULT 6 NOT NULL,
	"active_for_routing" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "route_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"episode_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"suggested_user_id" uuid NOT NULL,
	"status" "route_suggestion_status" DEFAULT 'pending' NOT NULL,
	"score_total" integer DEFAULT 0 NOT NULL,
	"score_breakdown_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"required_skills_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"engine_version" text DEFAULT 'rules-v1' NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by" uuid,
	"decision_reason_code" text,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "visit_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"episode_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"task_type" "visit_task_type" NOT NULL,
	"status" "visit_task_status" DEFAULT 'open' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"priority" text DEFAULT 'routine' NOT NULL,
	"due_at" timestamp with time zone,
	"scheduled_at" timestamp with time zone,
	"assignee_user_id" uuid,
	"completed_at" timestamp with time zone,
	"completed_by" uuid,
	"completion_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hospitalization_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"episode_id" uuid,
	"facility_name" text NOT NULL,
	"admitted_at" timestamp with time zone,
	"source" text DEFAULT 'manual' NOT NULL,
	"status" "hospitalization_alert_status" DEFAULT 'new' NOT NULL,
	"notes" text,
	"external_ref" text,
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "clinician_profiles" ADD CONSTRAINT "clinician_profiles_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "clinician_profiles" ADD CONSTRAINT "clinician_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "route_suggestions" ADD CONSTRAINT "route_suggestions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "route_suggestions" ADD CONSTRAINT "route_suggestions_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "route_suggestions" ADD CONSTRAINT "route_suggestions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "route_suggestions" ADD CONSTRAINT "route_suggestions_suggested_user_id_users_id_fk" FOREIGN KEY ("suggested_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "route_suggestions" ADD CONSTRAINT "route_suggestions_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "route_suggestions" ADD CONSTRAINT "route_suggestions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "visit_tasks" ADD CONSTRAINT "visit_tasks_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "visit_tasks" ADD CONSTRAINT "visit_tasks_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "visit_tasks" ADD CONSTRAINT "visit_tasks_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "visit_tasks" ADD CONSTRAINT "visit_tasks_assignee_user_id_users_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "visit_tasks" ADD CONSTRAINT "visit_tasks_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "visit_tasks" ADD CONSTRAINT "visit_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "hospitalization_alerts" ADD CONSTRAINT "hospitalization_alerts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "hospitalization_alerts" ADD CONSTRAINT "hospitalization_alerts_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "hospitalization_alerts" ADD CONSTRAINT "hospitalization_alerts_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "hospitalization_alerts" ADD CONSTRAINT "hospitalization_alerts_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "hospitalization_alerts" ADD CONSTRAINT "hospitalization_alerts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "clinician_profiles_user_uidx" ON "clinician_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clinician_profiles_org_idx" ON "clinician_profiles" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "route_suggestions_episode_status_idx" ON "route_suggestions" USING btree ("episode_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "route_suggestions_org_status_idx" ON "route_suggestions" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visit_tasks_org_status_idx" ON "visit_tasks" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visit_tasks_assignee_idx" ON "visit_tasks" USING btree ("assignee_user_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hospitalization_alerts_org_status_idx" ON "hospitalization_alerts" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hospitalization_alerts_patient_idx" ON "hospitalization_alerts" USING btree ("patient_id");
