ALTER TYPE "public"."category_type" ADD VALUE 'accessory';--> statement-breakpoint
ALTER TYPE "public"."category_type" ADD VALUE 'component';--> statement-breakpoint
ALTER TYPE "public"."checkoutable_type" ADD VALUE 'accessory_assignment';--> statement-breakpoint
ALTER TYPE "public"."checkoutable_type" ADD VALUE 'component_assignment';--> statement-breakpoint
CREATE TABLE "accessories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"manufacturer_id" uuid,
	"name" text NOT NULL,
	"model_number" text,
	"qty_total" integer DEFAULT 0 NOT NULL,
	"min_qty" integer DEFAULT 0 NOT NULL,
	"purchase_cost" numeric(12, 2),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accessory_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accessory_id" uuid NOT NULL,
	"assigned_to_user_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "component_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"component_id" uuid NOT NULL,
	"assigned_to_asset_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"manufacturer_id" uuid,
	"name" text NOT NULL,
	"model_number" text,
	"qty_total" integer DEFAULT 0 NOT NULL,
	"min_qty" integer DEFAULT 0 NOT NULL,
	"purchase_cost" numeric(12, 2),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checkouts" ALTER COLUMN "assigned_to_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "checkouts" ADD COLUMN "assigned_to_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "accessories" ADD CONSTRAINT "accessories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accessories" ADD CONSTRAINT "accessories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accessories" ADD CONSTRAINT "accessories_manufacturer_id_manufacturers_id_fk" FOREIGN KEY ("manufacturer_id") REFERENCES "public"."manufacturers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accessory_assignments" ADD CONSTRAINT "accessory_assignments_accessory_id_accessories_id_fk" FOREIGN KEY ("accessory_id") REFERENCES "public"."accessories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accessory_assignments" ADD CONSTRAINT "accessory_assignments_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_assignments" ADD CONSTRAINT "component_assignments_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_assignments" ADD CONSTRAINT "component_assignments_assigned_to_asset_id_assets_id_fk" FOREIGN KEY ("assigned_to_asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_manufacturer_id_manufacturers_id_fk" FOREIGN KEY ("manufacturer_id") REFERENCES "public"."manufacturers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accessories_company_id_idx" ON "accessories" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "accessory_assignments_accessory_id_idx" ON "accessory_assignments" USING btree ("accessory_id");--> statement-breakpoint
CREATE INDEX "accessory_assignments_assigned_to_user_id_idx" ON "accessory_assignments" USING btree ("assigned_to_user_id");--> statement-breakpoint
CREATE INDEX "component_assignments_component_id_idx" ON "component_assignments" USING btree ("component_id");--> statement-breakpoint
CREATE INDEX "component_assignments_assigned_to_asset_id_idx" ON "component_assignments" USING btree ("assigned_to_asset_id");--> statement-breakpoint
CREATE INDEX "components_company_id_idx" ON "components" USING btree ("company_id");--> statement-breakpoint
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_assigned_to_asset_id_assets_id_fk" FOREIGN KEY ("assigned_to_asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checkouts_assigned_to_asset_id_idx" ON "checkouts" USING btree ("assigned_to_asset_id");--> statement-breakpoint
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_exactly_one_target" CHECK (("checkouts"."assigned_to_user_id" is not null) != ("checkouts"."assigned_to_asset_id" is not null));