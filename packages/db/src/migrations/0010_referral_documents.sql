-- Referral document attachment + structured extract payload
ALTER TABLE "referrals" ADD COLUMN IF NOT EXISTS "document_file_name" text;--> statement-breakpoint
ALTER TABLE "referrals" ADD COLUMN IF NOT EXISTS "document_content_type" text;--> statement-breakpoint
ALTER TABLE "referrals" ADD COLUMN IF NOT EXISTS "document_text" text;--> statement-breakpoint
ALTER TABLE "referrals" ADD COLUMN IF NOT EXISTS "extracted_json" text;--> statement-breakpoint
