ALTER TABLE "requests" ADD COLUMN "checkout_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "checkout_target_user_id" uuid;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "expected_checkin_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_checkout_asset_id_assets_id_fk" FOREIGN KEY ("checkout_asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_checkout_target_user_id_users_id_fk" FOREIGN KEY ("checkout_target_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;