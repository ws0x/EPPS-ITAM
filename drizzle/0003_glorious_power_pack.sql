ALTER TABLE "categories" ADD COLUMN "code_prefix" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "last_sequence" integer DEFAULT 0 NOT NULL;