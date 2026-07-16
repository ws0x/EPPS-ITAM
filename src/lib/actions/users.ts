"use server";

import { eq, and, or, asc, desc, ilike, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/db/client";
import {
  users,
  roles,
  departments,
  locations,
  assets,
  models,
  manufacturers,
  licenseSeats,
  licenses,
  kits,
  consumables,
  consumableAssignments,
  checkouts,
} from "@/db/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { logCreate, logUpdate } from "@/lib/audit";

export async function listUsers() {
  const user = await requireUser();
  return db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(users)
    .where(eq(users.companyId, user.companyId))
    .orderBy(asc(users.firstName));
}

export async function listUsersFull(search?: string) {
  const user = await requireUser();
  const trimmed = search?.trim();
  return db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      firstName: users.firstName,
      lastName: users.lastName,
      jobTitle: users.jobTitle,
      phone: users.phone,
      employeeNumber: users.employeeNumber,
      loginEnabled: users.loginEnabled,
      roleId: users.roleId,
      roleName: roles.name,
      departmentId: users.departmentId,
      departmentName: departments.name,
      locationId: users.locationId,
      locationName: locations.name,
      managerId: users.managerId,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .leftJoin(locations, eq(users.locationId, locations.id))
    .where(
      and(
        eq(users.companyId, user.companyId),
        trimmed
          ? or(
              ilike(users.firstName, `%${trimmed}%`),
              ilike(users.lastName, `%${trimmed}%`),
              ilike(users.email, `%${trimmed}%`),
            )
          : undefined,
      ),
    )
    .orderBy(asc(users.firstName));
}

export async function listRoles() {
  await requireUser();
  return db.select().from(roles).orderBy(asc(roles.name));
}

export async function getUserWithDetails(id: string) {
  const currentUser = await requireUser();
  const manager = alias(users, "manager");

  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      firstName: users.firstName,
      lastName: users.lastName,
      jobTitle: users.jobTitle,
      phone: users.phone,
      employeeNumber: users.employeeNumber,
      loginEnabled: users.loginEnabled,
      notes: users.notes,
      roleId: users.roleId,
      roleName: roles.name,
      departmentId: users.departmentId,
      departmentName: departments.name,
      locationId: users.locationId,
      locationName: locations.name,
      managerId: users.managerId,
      managerFirstName: manager.firstName,
      managerLastName: manager.lastName,
      managerEmail: manager.email,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .leftJoin(locations, eq(users.locationId, locations.id))
    .leftJoin(manager, eq(users.managerId, manager.id))
    .where(and(eq(users.id, id), eq(users.companyId, currentUser.companyId)))
    .limit(1);

  return row ?? null;
}

/** Everything this person currently holds - four separate arrays since each has a different "currently assigned" shape. */
export async function getUserHoldings(userId: string) {
  await requireUser();

  // LEFT JOIN to checkouts, not INNER - migrated legacy assets carry an
  // assignedToUserId with no corresponding checkouts row (the migration
  // didn't backfill synthetic checkout history), so an inner join here
  // would silently drop most real holdings for migrated users.
  const assignedAssets = db
    .select({
      id: assets.id,
      assetTag: assets.assetTag,
      modelName: sql<string>`concat(${manufacturers.name}, ' ', ${models.name})`,
      checkoutId: checkouts.id,
      checkedOutAt: checkouts.checkedOutAt,
    })
    .from(assets)
    .innerJoin(models, eq(assets.modelId, models.id))
    .innerJoin(manufacturers, eq(models.manufacturerId, manufacturers.id))
    .leftJoin(
      checkouts,
      and(eq(checkouts.checkoutableId, assets.id), eq(checkouts.checkoutableType, "asset"), isNull(checkouts.checkedInAt)),
    )
    .where(eq(assets.assignedToUserId, userId))
    .orderBy(desc(checkouts.checkedOutAt));

  const assignedLicenseSeats = db
    .select({
      id: licenseSeats.id,
      licenseId: licenses.id,
      licenseName: licenses.name,
      checkoutId: checkouts.id,
      checkedOutAt: checkouts.checkedOutAt,
    })
    .from(licenseSeats)
    .innerJoin(licenses, eq(licenseSeats.licenseId, licenses.id))
    .leftJoin(
      checkouts,
      and(
        eq(checkouts.checkoutableId, licenseSeats.id),
        eq(checkouts.checkoutableType, "license_seat"),
        isNull(checkouts.checkedInAt),
      ),
    )
    .where(eq(licenseSeats.assignedToUserId, userId))
    .orderBy(desc(checkouts.checkedOutAt));

  const assignedKits = db
    .select({
      id: kits.id,
      kitName: kits.name,
      checkoutId: checkouts.id,
      checkedOutAt: checkouts.checkedOutAt,
    })
    .from(kits)
    .innerJoin(
      checkouts,
      and(eq(checkouts.checkoutableId, kits.id), eq(checkouts.checkoutableType, "kit"), isNull(checkouts.checkedInAt)),
    )
    .where(eq(checkouts.assignedToUserId, userId))
    .orderBy(desc(checkouts.checkedOutAt));

  // Consumables have no check-in lifecycle (consumed, not returned) - this is
  // a distribution ledger, not a "currently holds" set like the others.
  const receivedConsumables = db
    .select({
      id: consumableAssignments.id,
      consumableName: consumables.name,
      quantity: consumableAssignments.quantity,
      assignedAt: consumableAssignments.createdAt,
    })
    .from(consumableAssignments)
    .innerJoin(consumables, eq(consumableAssignments.consumableId, consumables.id))
    .where(eq(consumableAssignments.assignedToUserId, userId))
    .orderBy(desc(consumableAssignments.createdAt));

  const [assetRows, licenseSeatRows, kitRows, consumableRows] = await Promise.all([
    assignedAssets,
    assignedLicenseSeats,
    assignedKits,
    receivedConsumables,
  ]);

  return { assets: assetRows, licenseSeats: licenseSeatRows, kits: kitRows, consumables: consumableRows };
}

/** This person's full historical checkout log across every checkoutable type, newest first. */
export async function getUserCheckoutHistory(userId: string) {
  await requireUser();
  const checkedOutBy = alias(users, "checked_out_by");
  const checkedInBy = alias(users, "checked_in_by");

  return db
    .select({
      id: checkouts.id,
      checkoutableType: checkouts.checkoutableType,
      itemName: sql<string>`case
        when ${checkouts.checkoutableType} = 'asset' then concat(${assets.assetTag}, coalesce(' - ' || ${models.name}, ''))
        when ${checkouts.checkoutableType} = 'license_seat' then ${licenses.name}
        when ${checkouts.checkoutableType} = 'kit' then ${kits.name}
        when ${checkouts.checkoutableType} = 'consumable_assignment' then ${consumables.name}
        else 'Unknown item'
      end`,
      checkedOutAt: checkouts.checkedOutAt,
      checkedInAt: checkouts.checkedInAt,
      expectedCheckinAt: checkouts.expectedCheckinAt,
      notes: checkouts.notes,
      checkedOutByFirstName: checkedOutBy.firstName,
      checkedOutByLastName: checkedOutBy.lastName,
      checkedOutByEmail: checkedOutBy.email,
      checkedInByFirstName: checkedInBy.firstName,
      checkedInByLastName: checkedInBy.lastName,
    })
    .from(checkouts)
    .leftJoin(assets, and(eq(checkouts.checkoutableType, "asset"), eq(checkouts.checkoutableId, assets.id)))
    .leftJoin(models, eq(assets.modelId, models.id))
    .leftJoin(licenseSeats, and(eq(checkouts.checkoutableType, "license_seat"), eq(checkouts.checkoutableId, licenseSeats.id)))
    .leftJoin(licenses, eq(licenseSeats.licenseId, licenses.id))
    .leftJoin(kits, and(eq(checkouts.checkoutableType, "kit"), eq(checkouts.checkoutableId, kits.id)))
    .leftJoin(
      consumableAssignments,
      and(eq(checkouts.checkoutableType, "consumable_assignment"), eq(checkouts.checkoutableId, consumableAssignments.id)),
    )
    .leftJoin(consumables, eq(consumableAssignments.consumableId, consumables.id))
    .leftJoin(checkedOutBy, eq(checkouts.checkedOutByUserId, checkedOutBy.id))
    .leftJoin(checkedInBy, eq(checkouts.checkedInByUserId, checkedInBy.id))
    .where(eq(checkouts.assignedToUserId, userId))
    .orderBy(desc(checkouts.checkedOutAt));
}

export type ActionState = { error?: string } | undefined;

export async function createUserAccount(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const currentUser = await requireUser();
  requirePermission(currentUser, "users:manage");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const roleId = String(formData.get("roleId") ?? "");
  if (!email) return { error: "Email is required." };
  if (password.length < 8) return { error: "Temporary password must be at least 8 characters." };
  if (!roleId) return { error: "Role is required." };

  const supabaseAdmin = createAdminClient();
  const { data, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError) return { error: authError.message };

  try {
    const [newUser] = await db
      .insert(users)
      .values({
        id: data.user.id,
        companyId: currentUser.companyId,
        roleId,
        email,
        username: email.split("@")[0],
        firstName: emptyToNull(formData.get("firstName")),
        lastName: emptyToNull(formData.get("lastName")),
        jobTitle: emptyToNull(formData.get("jobTitle")),
        phone: emptyToNull(formData.get("phone")),
        employeeNumber: emptyToNull(formData.get("employeeNumber")),
        departmentId: emptyToNull(formData.get("departmentId")),
        locationId: emptyToNull(formData.get("locationId")),
        managerId: emptyToNull(formData.get("managerId")),
        loginEnabled: true,
      })
      .returning();

    await logCreate(db, {
      companyId: currentUser.companyId,
      actorUserId: currentUser.id,
      targetType: "user",
      targetId: newUser.id,
      row: newUser,
    });
  } catch (err) {
    // Roll back the orphaned auth account if the profile insert fails.
    await supabaseAdmin.auth.admin.deleteUser(data.user.id);
    throw err;
  }

  revalidatePath("/users");
}

export async function updateUserAccount(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const currentUser = await requireUser();
  requirePermission(currentUser, "users:manage");

  const id = String(formData.get("id"));
  const roleId = String(formData.get("roleId") ?? "");
  if (!roleId) return { error: "Role is required." };

  const [before] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!before) return { error: "User not found." };

  const [after] = await db
    .update(users)
    .set({
      roleId,
      firstName: emptyToNull(formData.get("firstName")),
      lastName: emptyToNull(formData.get("lastName")),
      jobTitle: emptyToNull(formData.get("jobTitle")),
      phone: emptyToNull(formData.get("phone")),
      employeeNumber: emptyToNull(formData.get("employeeNumber")),
      departmentId: emptyToNull(formData.get("departmentId")),
      locationId: emptyToNull(formData.get("locationId")),
      managerId: emptyToNull(formData.get("managerId")),
      loginEnabled: formData.get("loginEnabled") === "on",
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning();

  await logUpdate(db, {
    companyId: currentUser.companyId,
    actorUserId: currentUser.id,
    targetType: "user",
    targetId: id,
    before,
    after,
  });

  revalidatePath("/users");
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const str = value ? String(value).trim() : "";
  return str.length ? str : null;
}
