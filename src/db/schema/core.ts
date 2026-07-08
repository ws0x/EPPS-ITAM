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
    // Matches auth.users.id (Supabase Auth) — not a separate identity.
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
