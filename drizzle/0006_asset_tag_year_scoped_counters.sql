CREATE TABLE "asset_tag_counters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"last_sequence" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "asset_tag_counters_category_id_year_unique" UNIQUE("category_id","year")
);
--> statement-breakpoint
ALTER TABLE "asset_tag_counters" ADD CONSTRAINT "asset_tag_counters_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" DROP COLUMN "last_sequence";