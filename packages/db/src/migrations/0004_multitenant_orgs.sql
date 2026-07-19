ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "slug" text;--> statement-breakpoint
UPDATE "organizations" SET "slug" = 'demo-agency' WHERE "slug" IS NULL;--> statement-breakpoint
ALTER TABLE "organizations" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_slug_uidx" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE TYPE "public"."org_invite_status" AS ENUM('pending', 'accepted', 'revoked', 'expired');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"role_code" "role_code" NOT NULL,
	"status" "org_invite_status" DEFAULT 'pending' NOT NULL,
	"token_hash" text NOT NULL,
	"invited_user_id" uuid,
	"invited_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "org_invites" ADD CONSTRAINT "org_invites_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "org_invites" ADD CONSTRAINT "org_invites_invited_user_id_users_id_fk" FOREIGN KEY ("invited_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "org_invites" ADD CONSTRAINT "org_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "org_invites_token_hash_uidx" ON "org_invites" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_invites_org_email_idx" ON "org_invites" USING btree ("org_id","email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_invites_org_status_idx" ON "org_invites" USING btree ("org_id","status");
