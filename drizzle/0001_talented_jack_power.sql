CREATE TYPE "public"."po_status" AS ENUM('draft', 'pending_approval', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "po_beneficiary_companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "po_beneficiary_companies_company_id_name_unique" UNIQUE("company_id","name")
);
--> statement-breakpoint
CREATE TABLE "po_beneficiary_departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "po_beneficiary_departments_company_id_name_unique" UNIQUE("company_id","name")
);
--> statement-breakpoint
CREATE TABLE "po_counters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"last_sequence" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "po_counters_company_id_year_unique" UNIQUE("company_id","year")
);
--> statement-breakpoint
CREATE TABLE "purchase_order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"po_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"item_code" text,
	"description" text NOT NULL,
	"unit" text,
	"unit_price" numeric(12, 2) NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"beneficiary_company" text NOT NULL,
	"beneficiary_department" text NOT NULL,
	"beneficiary_employee" text
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"po_number" text NOT NULL,
	"po_year" integer NOT NULL,
	"po_sequence" integer NOT NULL,
	"date" date NOT NULL,
	"pr_number" text,
	"supplier_name" text NOT NULL,
	"supplier_address" text,
	"supplier_tel" text,
	"supplier_fax" text,
	"supplier_email" text,
	"vat_registered" boolean DEFAULT false NOT NULL,
	"advance_payment_registered" boolean DEFAULT false NOT NULL,
	"e_invoiced" boolean DEFAULT false NOT NULL,
	"misc_amount" numeric(12, 2),
	"misc_type" text,
	"payment_term" text,
	"delivery_date" date,
	"note" text,
	"prepared_by_user_id" uuid NOT NULL,
	"approver_user_id" uuid NOT NULL,
	"status" "po_status" DEFAULT 'draft' NOT NULL,
	"approval_token_hash" text,
	"rejection_reason" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_po_number_unique" UNIQUE("po_number")
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "managing_director_user_id" uuid;--> statement-breakpoint
ALTER TABLE "po_beneficiary_companies" ADD CONSTRAINT "po_beneficiary_companies_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "po_beneficiary_departments" ADD CONSTRAINT "po_beneficiary_departments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "po_counters" ADD CONSTRAINT "po_counters_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_prepared_by_user_id_users_id_fk" FOREIGN KEY ("prepared_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_approver_user_id_users_id_fk" FOREIGN KEY ("approver_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_managing_director_user_id_users_id_fk" FOREIGN KEY ("managing_director_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;