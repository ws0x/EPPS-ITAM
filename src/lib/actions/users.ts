"use server";

import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/db/client";
import { users, roles, departments, locations } from "@/db/schema";
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

export async function listUsersFull() {
  const user = await requireUser();
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
    .where(eq(users.companyId, user.companyId))
    .orderBy(asc(users.firstName));
}

export async function listRoles() {
  await requireUser();
  return db.select().from(roles).orderBy(asc(roles.name));
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
