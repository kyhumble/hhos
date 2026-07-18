CREATE TYPE "public"."annotation_status" AS ENUM('pending_upload', 'pending_put', 'available', 'failed', 'abandoned', 'soft_deleted');--> statement-breakpoint
CREATE TYPE "public"."annotation_type" AS ENUM('vector_json', 'overlay_png');--> statement-breakpoint
CREATE TYPE "public"."capture_source" AS ENUM('app_camera');--> statement-breakpoint
CREATE TYPE "public"."clinical_task_priority" AS ENUM('routine', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."clinical_task_status" AS ENUM('open', 'in_progress', 'done', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."clinical_task_type" AS ENUM('large_wound_review', 'photo_qa', 'other');--> statement-breakpoint
CREATE TYPE "public"."measurement_method" AS ENUM('manual_ruler', 'app_overlay', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."visit_status" AS ENUM('in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."visit_type" AS ENUM('soc', 'routine', 'prn', 'other');--> statement-breakpoint
CREATE TYPE "public"."wound_laterality" AS ENUM('left', 'right', 'bilateral', 'midline', 'na');--> statement-breakpoint
CREATE TYPE "public"."wound_photo_status" AS ENUM('pending_upload', 'pending_put', 'available', 'failed', 'abandoned', 'soft_deleted');--> statement-breakpoint
CREATE TYPE "public"."wound_status" AS ENUM('active', 'healed', 'transferred', 'void');--> statement-breakpoint
CREATE TYPE "public"."device_platform" AS ENUM('ios', 'android');--> statement-breakpoint
CREATE TYPE "public"."device_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TABLE "clinical_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"episode_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"wound_photo_id" uuid,
	"task_type" "clinical_task_type" NOT NULL,
	"status" "clinical_task_status" DEFAULT 'open' NOT NULL,
	"priority" "clinical_task_priority" DEFAULT 'routine' NOT NULL,
	"title" text NOT NULL,
	"details" text,
	"assignee_user_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photo_annotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"wound_photo_id" uuid NOT NULL,
	"client_annotation_id" text NOT NULL,
	"annotation_type" "annotation_type" NOT NULL,
	"status" "annotation_status" DEFAULT 'pending_upload' NOT NULL,
	"storage_key" text,
	"wrapped_dek" "bytea",
	"kek_key_id" text,
	"cipher_sha256" char(64),
	"byte_size" integer,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"episode_id" uuid NOT NULL,
	"clinician_user_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"visit_type" "visit_type" NOT NULL,
	"status" "visit_status" DEFAULT 'in_progress' NOT NULL,
	"client_visit_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "wound_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"episode_id" uuid NOT NULL,
	"wound_id" uuid NOT NULL,
	"visit_id" uuid,
	"consent_record_id" uuid NOT NULL,
	"client_photo_id" text NOT NULL,
	"status" "wound_photo_status" DEFAULT 'pending_upload' NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"captured_by_user_id" uuid NOT NULL,
	"device_id" text NOT NULL,
	"device_model" text,
	"device_os" text,
	"app_version" text,
	"geo_lat" double precision,
	"geo_lng" double precision,
	"geo_accuracy_m" double precision,
	"content_type" text DEFAULT 'image/jpeg' NOT NULL,
	"byte_size" integer,
	"plaintext_sha256" char(64),
	"cipher_sha256" char(64),
	"storage_key" text,
	"wrapped_dek" "bytea",
	"kek_key_id" text,
	"width_px" integer,
	"height_px" integer,
	"capture_source" "capture_source" DEFAULT 'app_camera' NOT NULL,
	"purpose_at_capture" "purpose_code" DEFAULT 'WOUND_PHOTO_CLINICAL' NOT NULL,
	"length_cm" numeric(6, 2),
	"width_cm" numeric(6, 2),
	"depth_cm" numeric(6, 2),
	"measurement_method" "measurement_method",
	"is_large_wound" boolean DEFAULT false NOT NULL,
	"uploaded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "wounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"episode_id" uuid NOT NULL,
	"label" text NOT NULL,
	"body_site_code" text,
	"laterality" "wound_laterality" NOT NULL,
	"wound_type" text,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"status" "wound_status" DEFAULT 'active' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "device_revocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_row_id" uuid NOT NULL,
	"revoked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_by_user_id" uuid NOT NULL,
	"reason" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" text NOT NULL,
	"platform" "device_platform" NOT NULL,
	"model" text,
	"os_version" text,
	"app_version" text NOT NULL,
	"status" "device_status" DEFAULT 'active' NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ALTER COLUMN "settings" SET DEFAULT '{"socDueHours":48,"photoGeotagEnabled":false,"coverageVerifiedRequired":false,"woundPathwayDefault":true,"largeWoundLengthCm":10,"largeWoundWidthCm":10,"largeWoundAreaCm2":50,"photoMaxBytes":12000000,"photoPendingTtlHours":24}'::jsonb;--> statement-breakpoint
ALTER TABLE "clinical_tasks" ADD CONSTRAINT "clinical_tasks_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_tasks" ADD CONSTRAINT "clinical_tasks_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_tasks" ADD CONSTRAINT "clinical_tasks_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_tasks" ADD CONSTRAINT "clinical_tasks_wound_photo_id_wound_photos_id_fk" FOREIGN KEY ("wound_photo_id") REFERENCES "public"."wound_photos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_tasks" ADD CONSTRAINT "clinical_tasks_assignee_user_id_users_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_tasks" ADD CONSTRAINT "clinical_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_annotations" ADD CONSTRAINT "photo_annotations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_annotations" ADD CONSTRAINT "photo_annotations_wound_photo_id_wound_photos_id_fk" FOREIGN KEY ("wound_photo_id") REFERENCES "public"."wound_photos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_annotations" ADD CONSTRAINT "photo_annotations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_clinician_user_id_users_id_fk" FOREIGN KEY ("clinician_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wound_photos" ADD CONSTRAINT "wound_photos_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wound_photos" ADD CONSTRAINT "wound_photos_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wound_photos" ADD CONSTRAINT "wound_photos_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wound_photos" ADD CONSTRAINT "wound_photos_wound_id_wounds_id_fk" FOREIGN KEY ("wound_id") REFERENCES "public"."wounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wound_photos" ADD CONSTRAINT "wound_photos_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wound_photos" ADD CONSTRAINT "wound_photos_consent_record_id_consent_records_id_fk" FOREIGN KEY ("consent_record_id") REFERENCES "public"."consent_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wound_photos" ADD CONSTRAINT "wound_photos_captured_by_user_id_users_id_fk" FOREIGN KEY ("captured_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wounds" ADD CONSTRAINT "wounds_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wounds" ADD CONSTRAINT "wounds_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wounds" ADD CONSTRAINT "wounds_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wounds" ADD CONSTRAINT "wounds_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_revocations" ADD CONSTRAINT "device_revocations_device_row_id_devices_id_fk" FOREIGN KEY ("device_row_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_revocations" ADD CONSTRAINT "device_revocations_revoked_by_user_id_users_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "photo_annotations_org_client_annotation_uidx" ON "photo_annotations" USING btree ("org_id","client_annotation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "visits_org_client_visit_uidx" ON "visits" USING btree ("org_id","client_visit_id") WHERE "visits"."client_visit_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "wound_photos_org_client_photo_uidx" ON "wound_photos" USING btree ("org_id","client_photo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "devices_org_device_uidx" ON "devices" USING btree ("org_id","device_id");