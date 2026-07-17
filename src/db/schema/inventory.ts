import { pgTable, uuid, text, integer, numeric, date, timestamp, jsonb, pgEnum, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { companies, departments, locations, users } from "./core";
import { categories, manufacturers, models, statusLabels, suppliers, depreciations } from "./catalog";

/**
 * Serialized, individually trackable items (laptops, phones, servers...).
 * `attributes` holds values matching the owning category's attributesSchema.
 */
export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    modelId: uuid("model_id").notNull().references(() => models.id),
    statusId: uuid("status_id").notNull().references(() => statusLabels.id),
    supplierId: uuid("supplier_id").references(() => suppliers.id),
    depreciationId: uuid("depreciation_id").references(() => depreciations.id),
    assetTag: text("asset_tag").notNull().unique(),
    name: text("name"),
    serial: text("serial"),
    // Current physical location; rtdLocationId is where it returns to on checkin.
    locationId: uuid("location_id").references(() => locations.id),
    rtdLocationId: uuid("rtd_location_id").references(() => locations.id),
    departmentId: uuid("department_id").references(() => departments.id),
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id),
    purchaseDate: date("purchase_date"),
    purchaseCost: numeric("purchase_cost", { precision: 12, scale: 2 }),
    currentValue: numeric("current_value", { precision: 12, scale: 2 }),
    orderNumber: text("order_number"),
    warrantyMonths: integer("warranty_months"),
    warrantyExpiresAt: date("warranty_expires_at"),
    nextAuditDate: date("next_audit_date"),
    lastAuditAt: timestamp("last_audit_at", { withTimezone: true }),
    notes: text("notes"),
    imageUrl: text("image_url"),
    attributes: jsonb("attributes").$type<Record<string, unknown>>().default({}).notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("assets_company_id_idx").on(table.companyId),
    index("assets_model_id_idx").on(table.modelId),
    index("assets_status_id_idx").on(table.statusId),
    index("assets_assigned_to_user_id_idx").on(table.assignedToUserId),
    index("assets_location_id_idx").on(table.locationId),
  ],
);

export const licenses = pgTable(
  "licenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    categoryId: uuid("category_id").notNull().references(() => categories.id),
    manufacturerId: uuid("manufacturer_id").references(() => manufacturers.id),
    name: text("name").notNull(),
    licenseKey: text("license_key"),
    seatsTotal: integer("seats_total").default(1).notNull(),
    purchaseDate: date("purchase_date"),
    purchaseCost: numeric("purchase_cost", { precision: 12, scale: 2 }),
    expiresAt: date("expires_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("licenses_company_id_idx").on(table.companyId)],
);

export const licenseSeats = pgTable(
  "license_seats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    licenseId: uuid("license_id").notNull().references(() => licenses.id),
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id),
    assignedToAssetId: uuid("assigned_to_asset_id").references(() => assets.id),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("license_seats_license_id_idx").on(table.licenseId),
    index("license_seats_assigned_to_user_id_idx").on(table.assignedToUserId),
  ],
);

export const consumables = pgTable(
  "consumables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    categoryId: uuid("category_id").notNull().references(() => categories.id),
    manufacturerId: uuid("manufacturer_id").references(() => manufacturers.id),
    name: text("name").notNull(),
    modelNumber: text("model_number"),
    qtyTotal: integer("qty_total").default(0).notNull(),
    minQty: integer("min_qty").default(0).notNull(),
    purchaseCost: numeric("purchase_cost", { precision: 12, scale: 2 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("consumables_company_id_idx").on(table.companyId)],
);

export const consumableAssignments = pgTable(
  "consumable_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    consumableId: uuid("consumable_id").notNull().references(() => consumables.id),
    assignedToUserId: uuid("assigned_to_user_id").notNull().references(() => users.id),
    quantity: integer("quantity").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("consumable_assignments_consumable_id_idx").on(table.consumableId),
    index("consumable_assignments_assigned_to_user_id_idx").on(table.assignedToUserId),
  ],
);

export const kits = pgTable(
  "kits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("kits_company_id_idx").on(table.companyId)],
);

export const kitItemTypeEnum = pgEnum("kit_item_type", ["model", "consumable", "license"]);

export const kitItems = pgTable(
  "kit_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kitId: uuid("kit_id").notNull().references(() => kits.id),
    itemType: kitItemTypeEnum("item_type").notNull(),
    itemId: uuid("item_id").notNull(), // polymorphic: models.id | consumables.id | licenses.id
    quantity: integer("quantity").default(1).notNull(),
  },
  (table) => [index("kit_items_kit_id_idx").on(table.kitId)],
);

/**
 * Quantity-tracked, checked out to a PERSON, returnable (e.g. a keyboard,
 * headset) - distinct from `consumables`, which are consumed and never
 * returned. `qtyTotal` is the total owned and never changes on checkout;
 * available = qtyTotal - sum(open accessoryAssignments.quantity), computed
 * on read (see src/lib/actions/accessories.ts) rather than stored, so it
 * can never drift out of sync with the assignment ledger.
 */
export const accessories = pgTable(
  "accessories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    categoryId: uuid("category_id").notNull().references(() => categories.id),
    manufacturerId: uuid("manufacturer_id").references(() => manufacturers.id),
    name: text("name").notNull(),
    modelNumber: text("model_number"),
    qtyTotal: integer("qty_total").default(0).notNull(),
    minQty: integer("min_qty").default(0).notNull(),
    purchaseCost: numeric("purchase_cost", { precision: 12, scale: 2 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("accessories_company_id_idx").on(table.companyId)],
);

/**
 * One row per checkout transaction (e.g. "3 units to Alice on date X"), not
 * a slot - a single accessory can have many concurrent assignments, unlike
 * a license seat. Lifecycle (open vs. returned) lives on the paired
 * `checkouts` row (checkoutableType = "accessory_assignment"), same pattern
 * as license_seat/consumable_assignment, so this table doesn't duplicate a
 * status field.
 */
export const accessoryAssignments = pgTable(
  "accessory_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accessoryId: uuid("accessory_id").notNull().references(() => accessories.id),
    assignedToUserId: uuid("assigned_to_user_id").notNull().references(() => users.id),
    quantity: integer("quantity").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("accessory_assignments_accessory_id_idx").on(table.accessoryId),
    index("accessory_assignments_assigned_to_user_id_idx").on(table.assignedToUserId),
  ],
);

/**
 * Quantity-tracked, assigned to a specific ASSET (not a person) - e.g. a
 * RAM stick installed in a particular laptop. This is what actually
 * distinguishes Components from Accessories in Snipe-IT; it isn't a
 * renamed duplicate. Same qtyTotal/available-on-read shape as accessories.
 */
export const components = pgTable(
  "components",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    categoryId: uuid("category_id").notNull().references(() => categories.id),
    manufacturerId: uuid("manufacturer_id").references(() => manufacturers.id),
    name: text("name").notNull(),
    modelNumber: text("model_number"),
    qtyTotal: integer("qty_total").default(0).notNull(),
    minQty: integer("min_qty").default(0).notNull(),
    purchaseCost: numeric("purchase_cost", { precision: 12, scale: 2 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("components_company_id_idx").on(table.companyId)],
);

/** One row per install transaction, mirroring accessoryAssignments' shape. */
export const componentAssignments = pgTable(
  "component_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    componentId: uuid("component_id").notNull().references(() => components.id),
    assignedToAssetId: uuid("assigned_to_asset_id").notNull().references(() => assets.id),
    quantity: integer("quantity").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("component_assignments_component_id_idx").on(table.componentId),
    index("component_assignments_assigned_to_asset_id_idx").on(table.assignedToAssetId),
  ],
);

export const assetsRelations = relations(assets, ({ one }) => ({
  model: one(models, { fields: [assets.modelId], references: [models.id] }),
  status: one(statusLabels, { fields: [assets.statusId], references: [statusLabels.id] }),
  location: one(locations, { fields: [assets.locationId], references: [locations.id] }),
  rtdLocation: one(locations, { fields: [assets.rtdLocationId], references: [locations.id] }),
  department: one(departments, { fields: [assets.departmentId], references: [departments.id] }),
  assignedTo: one(users, { fields: [assets.assignedToUserId], references: [users.id] }),
  supplier: one(suppliers, { fields: [assets.supplierId], references: [suppliers.id] }),
}));

export const licensesRelations = relations(licenses, ({ one, many }) => ({
  category: one(categories, { fields: [licenses.categoryId], references: [categories.id] }),
  manufacturer: one(manufacturers, { fields: [licenses.manufacturerId], references: [manufacturers.id] }),
  seats: many(licenseSeats),
}));

export const kitsRelations = relations(kits, ({ many }) => ({
  items: many(kitItems),
}));
