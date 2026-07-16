import { pgTable, uuid, text, integer, numeric, date, timestamp, boolean, pgEnum, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { companies, users } from "./core";

/**
 * Beneficiary Company/Department are Finance's own reference lists for
 * tracking who a PO's items are ultimately for — deliberately separate
 * from ITAM's HR/org-structure `departments` table, since the two
 * taxonomies don't line up (confirmed against the real Excel template's
 * "Ranges" sheet: entries like "Warehouses" and "Fibco Global" aren't
 * departments in ITAM today). Admin-editable, seeded from that sheet.
 */
export const poBeneficiaryCompanies = pgTable(
  "po_beneficiary_companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
  },
  (table) => [unique().on(table.companyId, table.name)],
);

export const poBeneficiaryDepartments = pgTable(
  "po_beneficiary_departments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
  },
  (table) => [unique().on(table.companyId, table.name)],
);

/**
 * Per-company, per-year running counter backing the "IT {n}-{year}" PO
 * numbering scheme. A dedicated row (not `count(*) + 1`) so concurrent PO
 * creation can never hand out the same number twice — see
 * `nextPoNumber()` in lib/actions/purchase-orders.ts for the atomic
 * upsert-and-increment that uses this.
 */
export const poCounters = pgTable(
  "po_counters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    year: integer("year").notNull(),
    lastSequence: integer("last_sequence").notNull().default(0),
  },
  (table) => [unique().on(table.companyId, table.year)],
);

export const poStatusEnum = pgEnum("po_status", ["draft", "pending_approval", "approved", "rejected"]);

export const purchaseOrders = pgTable("purchase_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  poNumber: text("po_number").notNull().unique(),
  poYear: integer("po_year").notNull(),
  poSequence: integer("po_sequence").notNull(),
  date: date("date").notNull(),
  prNumber: text("pr_number"),
  quotationNumber: text("quotation_number"),

  supplierName: text("supplier_name").notNull(),
  supplierAddress: text("supplier_address"),
  supplierTel: text("supplier_tel"),
  supplierFax: text("supplier_fax"),
  supplierEmail: text("supplier_email"),

  vatRegistered: boolean("vat_registered").default(false).notNull(),
  advancePaymentRegistered: boolean("advance_payment_registered").default(false).notNull(),
  eInvoiced: boolean("e_invoiced").default(false).notNull(),
  miscAmount: numeric("misc_amount", { precision: 12, scale: 2 }),
  miscType: text("misc_type"),

  paymentTerm: text("payment_term"),
  deliveryDate: date("delivery_date"),
  note: text("note"),

  preparedByUserId: uuid("prepared_by_user_id").notNull().references(() => users.id),
  approverUserId: uuid("approver_user_id").notNull().references(() => users.id),
  status: poStatusEnum("status").default("draft").notNull(),
  approvalTokenHash: text("approval_token_hash"),
  rejectionReason: text("rejection_reason"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const purchaseOrderLines = pgTable("purchase_order_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  poId: uuid("po_id").notNull().references(() => purchaseOrders.id, { onDelete: "cascade" }),
  lineNumber: integer("line_number").notNull(),
  itemCode: text("item_code"),
  description: text("description").notNull(),
  unit: text("unit"),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  // Denormalized text, not a lookup-table FK — a PO is a point-in-time
  // financial document; it must not silently change if the reference
  // list is edited later. The lookup tables above only feed the create
  // form's dropdown options.
  beneficiaryCompany: text("beneficiary_company").notNull(),
  beneficiaryDepartment: text("beneficiary_department").notNull(),
  beneficiaryEmployee: text("beneficiary_employee"),
});

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  company: one(companies, { fields: [purchaseOrders.companyId], references: [companies.id] }),
  preparedBy: one(users, { fields: [purchaseOrders.preparedByUserId], references: [users.id] }),
  approver: one(users, { fields: [purchaseOrders.approverUserId], references: [users.id] }),
  lines: many(purchaseOrderLines),
}));

export const purchaseOrderLinesRelations = relations(purchaseOrderLines, ({ one }) => ({
  order: one(purchaseOrders, { fields: [purchaseOrderLines.poId], references: [purchaseOrders.id] }),
}));
