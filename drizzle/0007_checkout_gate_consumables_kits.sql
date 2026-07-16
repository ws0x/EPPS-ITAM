ALTER TABLE "requests" ADD COLUMN "checkout_consumable_id" uuid;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "checkout_kit_id" uuid;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_checkout_consumable_id_consumables_id_fk" FOREIGN KEY ("checkout_consumable_id") REFERENCES "public"."consumables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_checkout_kit_id_kits_id_fk" FOREIGN KEY ("checkout_kit_id") REFERENCES "public"."kits"("id") ON DELETE no action ON UPDATE no action;