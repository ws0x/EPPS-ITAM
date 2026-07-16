import { pgTable, uuid, text, integer, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { companies, users } from "./core";
import { models, categories } from "./catalog";
import { assets } from "./inventory";

export const checkoutableTypeEnum = pgEnum("checkoutable_type", [
  "asset",
  "license_seat",
  "consumable_assignment",
  "kit",
]);

export const checkouts = pgTable("checkouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  checkoutableType: checkoutableTypeEnum("checkoutable_type").notNull(),
  checkoutableId: uuid("checkoutable_id").notNull(), // polymorphic
  assignedToUserId: uuid("assigned_to_user_id").notNull().references(() => users.id),
  checkedOutByUserId: uuid("checked_out_by_user_id").notNull().references(() => users.id),
  checkedOutAt: timestamp("checked_out_at", { withTimezone: true }).defaultNow().notNull(),
  expectedCheckinAt: timestamp("expected_checkin_at", { withTimezone: true }),
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
  checkedInByUserId: uuid("checked_in_by_user_id").references(() => users.id),
  notes: text("notes"),
});

export const acceptanceStatusEnum = pgEnum("acceptance_status", ["pending", "accepted", "declined"]);

/**
 * E-signature / EULA acceptance on receiving an item - the one workflow
 * piece from the old system that was actually used and is worth keeping.
 */
export const acceptances = pgTable("acceptances", {
  id: uuid("id").primaryKey().defaultRandom(),
  checkoutId: uuid("checkout_id").notNull().references(() => checkouts.id),
  status: acceptanceStatusEnum("status").default("pending").notNull(),
  eulaSnapshot: text("eula_snapshot"),
  signatureUrl: text("signature_url"),
  note: text("note"),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  declinedAt: timestamp("declined_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const requestStatusEnum = pgEnum("request_status", [
  "pending_approval",
  "approved",
  "rejected",
  "fulfilled",
  "cancelled",
]);

/**
 * The new approval-cycle: employee requests a model/category, their direct
 * manager (resolved from users.managerId at creation time) approves or
 * rejects by email. This has no equivalent in the old system to migrate -
 * it's new. v1 is single-step only; a value/type-based tier can be added
 * later by branching on approverUserId resolution without a schema change.
 */
export const requests = pgTable("requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  requesterUserId: uuid("requester_user_id").notNull().references(() => users.id),
  approverUserId: uuid("approver_user_id").notNull().references(() => users.id),
  modelId: uuid("model_id").references(() => models.id),
  categoryId: uuid("category_id").references(() => categories.id),
  checkoutAssetId: uuid("checkout_asset_id").references(() => assets.id),
  checkoutTargetUserId: uuid("checkout_target_user_id").references(() => users.id),
  expectedCheckinAt: timestamp("expected_checkin_at", { withTimezone: true }),
  quantity: integer("quantity").default(1).notNull(),
  status: requestStatusEnum("status").default("pending_approval").notNull(),
  justification: text("justification"),
  rejectionReason: text("rejection_reason"),
  fulfilledCheckoutId: uuid("fulfilled_checkout_id").references(() => checkouts.id),
  approvalTokenHash: text("approval_token_hash"), // for one-click email approve/reject links
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  actionType: text("action_type").notNull(), // e.g. "asset.checkout", "request.approved"
  targetType: text("target_type").notNull(), // e.g. "asset", "request"
  targetId: uuid("target_id").notNull(),
  meta: jsonb("meta").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const checkoutsRelations = relations(checkouts, ({ one, many }) => ({
  assignedTo: one(users, { fields: [checkouts.assignedToUserId], references: [users.id] }),
  checkedOutBy: one(users, { fields: [checkouts.checkedOutByUserId], references: [users.id] }),
  acceptances: many(acceptances),
}));

export const requestsRelations = relations(requests, ({ one }) => ({
  requester: one(users, { fields: [requests.requesterUserId], references: [users.id] }),
  approver: one(users, { fields: [requests.approverUserId], references: [users.id] }),
  model: one(models, { fields: [requests.modelId], references: [models.id] }),
}));
