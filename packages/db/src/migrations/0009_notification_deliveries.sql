-- Phase 9: notification delivery tracking (invites, physician sign links)
-- No PHI: no tokens, patient names, DOB, or clinical free text.

CREATE TYPE "public"."notification_channel" AS ENUM('email', 'sms');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'sent', 'failed', 'suppressed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "channel" "notification_channel" DEFAULT 'email' NOT NULL,
  "template" text NOT NULL,
  "to_address" text NOT NULL,
  "status" "notification_status" DEFAULT 'pending' NOT NULL,
  "provider" text NOT NULL,
  "provider_message_id" text,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "last_error_code" text,
  "related_type" text,
  "related_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "sent_at" timestamp with time zone
);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "notification_deliveries"
    ADD CONSTRAINT "notification_deliveries_org_id_organizations_id_fk"
    FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_deliveries_org_status_idx"
  ON "notification_deliveries" ("org_id", "status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_deliveries_related_idx"
  ON "notification_deliveries" ("related_type", "related_id");--> statement-breakpoint

-- RLS (same org isolation as Phase 8)
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hhos_org_isolation ON public.notification_deliveries;
CREATE POLICY hhos_org_isolation ON public.notification_deliveries
  FOR ALL
  USING (hhos_rls_org_ok(org_id))
  WITH CHECK (hhos_rls_org_ok(org_id));

-- Grants for app role (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hhos_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_deliveries TO hhos_app;
  END IF;
END $$;
