import { pgTable, uuid, text, integer, boolean, jsonb, pgEnum, timestamp, unique, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { companies } from "./core";

export const categoryTypeEnum = pgEnum("category_type", [
  "asset",
  "license",
  "consumable",
  // accessory/component intentionally omitted from v1 scope.
  // Note: "kit" is NOT a category type - the kits/kitItems tables in
  // inventory.ts are a standalone bundle-for-checkout concept (e.g. "New
  // Hire Kit" = 1 laptop model + 1 mouse + 1 Office license), unrelated to
  // asset categories literally named "Kit" (which are single physical
  // toolboxes and stay category_type = 'asset').
]);

export const manufacturers = pgTable("manufacturers", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  name: text("name").notNull(),
  supportUrl: text("support_url"),
  supportPhone: text("support_phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const suppliers = pgTable("suppliers", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  name: text("name").notNull(),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  address: text("address"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * `attributesSchema` describes the custom fields for items in this category -
 * e.g. [{ key: "ram", label: "RAM", type: "text" }, ...]. Replaces Snipe-IT's
 * per-field database columns with one validated JSONB shape per category, so
 * adding a field for "Printers" never touches any other category's rows.
 */
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    type: categoryTypeEnum("type").notNull(),
    requiresAcceptance: boolean("requires_acceptance").default(false).notNull(),
    eulaText: text("eula_text"),
    attributesSchema: jsonb("attributes_schema").$type<CategoryAttributeDef[]>().default([]).notNull(),
    codePrefix: text("code_prefix"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("categories_company_id_idx").on(table.companyId)],
);

/**
 * Per-category, per-acquisition-year running counter backing the asset tag
 * scheme "{codePrefix}{YY}-{seq}" (e.g. LAP26-001). Year-scoped rather than a
 * lifetime `categories.lastSequence` counter (the original v1 design) so the
 * tag itself is more descriptive - it tells you what the item is AND when it
 * was acquired at a glance, useful for warranty/depreciation lookups without
 * opening the app - while staying short, since each category's count resets
 * every year instead of climbing forever. A dedicated row (not `count(*) +
 * 1`), same reasoning as `po_counters`: concurrent asset creation must never
 * hand out the same tag twice - see `nextAssetTag()` in lib/asset-tag.ts.
 */
export const assetTagCounters = pgTable(
  "asset_tag_counters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id").notNull().references(() => categories.id),
    year: integer("year").notNull(),
    lastSequence: integer("last_sequence").notNull().default(0),
  },
  (table) => [unique().on(table.categoryId, table.year)],
);

export type CategoryAttributeDef = {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "date" | "select";
  options?: string[];
  required?: boolean;
  showInList?: boolean;
};

/**
 * A purchasable model within a category, e.g. "Lenovo Laptop" under Laptop.
 * `defaultAttributes` pre-fills values matching the category's attribute
 * schema so every unit of the same model doesn't need re-entry.
 */
export const models = pgTable(
  "models",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    categoryId: uuid("category_id").notNull().references(() => categories.id),
    manufacturerId: uuid("manufacturer_id").references(() => manufacturers.id),
    name: text("name").notNull(),
    modelNumber: text("model_number"),
    defaultAttributes: jsonb("default_attributes").$type<Record<string, unknown>>().default({}).notNull(),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("models_company_id_idx").on(table.companyId),
    index("models_category_id_idx").on(table.categoryId),
  ],
);

export const statusLabels = pgTable("status_labels", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  name: text("name").notNull(),
  deployable: boolean("deployable").default(false).notNull(),
  pending: boolean("pending").default(false).notNull(),
  archived: boolean("archived").default(false).notNull(),
  color: text("color"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const depreciations = pgTable("depreciations", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  name: text("name").notNull(),
  months: integer("months").notNull(),
  minimumValuePct: integer("minimum_value_pct").default(0).notNull(),
});

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  company: one(companies, { fields: [categories.companyId], references: [companies.id] }),
  models: many(models),
}));

export const modelsRelations = relations(models, ({ one }) => ({
  category: one(categories, { fields: [models.categoryId], references: [categories.id] }),
  manufacturer: one(manufacturers, { fields: [models.manufacturerId], references: [manufacturers.id] }),
}));
