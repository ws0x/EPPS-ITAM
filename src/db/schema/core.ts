import { pgTable, uuid, text, timestamp, boolean, uniqueIndex, type AnyPgColumn } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * A legal entity within the group (e.g. EPPS HQ, Factory). MIG Commercial is
 * treated as part of EPPS HQ per business decision, not a separate company.
 */
export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  // Single fixed approver for every Purchase Order, company-wide - a real
  // business role (Managing Director signoff), not something that varies
  // per department, so it lives here rather than in the RBAC role system.
  managingDirectorUserId: uuid("managing_director_user_id").references((): AnyPgColumn => users.id),
  // Letterhead - rendered natively in the PO PDF (not baked into a pixel
  // image) so any of these can be edited without a code change. Only the
  // circular logo mark stays as an image; it's a real graphic, not text.
  letterheadLogoUrl: text("letterhead_logo_url"),
  letterheadNameLine1: text("letterhead_name_line1"),
  letterheadNameLine2: text("letterhead_name_line2"),
  letterheadTagline: text("letterhead_tagline"),
  letterheadOfficePhone: text("letterhead_office_phone"),
  letterheadMobilePhone: text("letterhead_mobile_phone"),
  letterheadFax: text("letterhead_fax"),
  letterheadEmails: text("letterhead_emails"),
  letterheadWebsite: text("letterhead_website"),
  letterheadAddress: text("letterhead_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Physical place only (building, floor, room). Org unit lives on `departments`
 * instead of being folded into location, unlike the old system.
 */
export const locations = pgTable("locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  parentLocationId: uuid("parent_location_id").references((): AnyPgColumn => locations.id),
  name: text("name").notNull(),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  currency: text("currency").default("EGP"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const departments = pgTable("departments", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  name: text("name").notNull(),
  managerId: uuid("manager_id").references((): AnyPgColumn => users.id),
  defaultLocationId: uuid("default_location_id").references(() => locations.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Named roles replace the old per-user ad-hoc permissions JSON. `permissions`
 * is still a JSONB escape hatch for fine-grained grants beyond the role name.
 */
export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(), // admin, it_manager, department_approver, technician, employee
  permissions: text("permissions").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable(
  "users",
  {
    // Matches auth.users.id (Supabase Auth) - not a separate identity.
    id: uuid("id").primaryKey(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    departmentId: uuid("department_id").references(() => departments.id),
    locationId: uuid("location_id").references(() => locations.id),
    roleId: uuid("role_id").notNull().references(() => roles.id),
    managerId: uuid("manager_id").references((): AnyPgColumn => users.id),
    email: text("email").notNull(),
    username: text("username").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    jobTitle: text("job_title"),
    phone: text("phone"),
    employeeNumber: text("employee_number"),
    avatarUrl: text("avatar_url"),
    notes: text("notes"),
    isServiceAccount: boolean("is_service_account").default(false).notNull(),
    loginEnabled: boolean("login_enabled").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("users_username_company_idx").on(table.companyId, table.username),
  ],
);

export const companiesRelations = relations(companies, ({ many }) => ({
  locations: many(locations),
  departments: many(departments),
  users: many(users),
}));

export const locationsRelations = relations(locations, ({ one, many }) => ({
  company: one(companies, { fields: [locations.companyId], references: [companies.id] }),
  parent: one(locations, { fields: [locations.parentLocationId], references: [locations.id] }),
  children: many(locations),
}));

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  company: one(companies, { fields: [departments.companyId], references: [companies.id] }),
  manager: one(users, { fields: [departments.managerId], references: [users.id] }),
  defaultLocation: one(locations, { fields: [departments.defaultLocationId], references: [locations.id] }),
  members: many(users),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  company: one(companies, { fields: [users.companyId], references: [companies.id] }),
  department: one(departments, { fields: [users.departmentId], references: [departments.id] }),
  location: one(locations, { fields: [users.locationId], references: [locations.id] }),
  role: one(roles, { fields: [users.roleId], references: [roles.id] }),
  manager: one(users, { fields: [users.managerId], references: [users.id] }),
  directReports: many(users),
}));
