"use server";

import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/db/client";
import { locations } from "@/db/schema";

export async function listLocations() {
  const user = await requireUser();
  return db
    .select()
    .from(locations)
    .where(eq(locations.companyId, user.companyId))
    .orderBy(asc(locations.name));
}

export type ActionState = { error?: string } | undefined;

export async function createLocation(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  requirePermission(user, "assets:*");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  await db.insert(locations).values({
    companyId: user.companyId,
    name,
    address: emptyToNull(formData.get("address")),
    city: emptyToNull(formData.get("city")),
    state: emptyToNull(formData.get("state")),
    parentLocationId: emptyToNull(formData.get("parentLocationId")),
  });

  revalidatePath("/locations");
}

export async function updateLocation(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  requirePermission(user, "assets:*");

  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  await db
    .update(locations)
    .set({
      name,
      address: emptyToNull(formData.get("address")),
      city: emptyToNull(formData.get("city")),
      state: emptyToNull(formData.get("state")),
      parentLocationId: emptyToNull(formData.get("parentLocationId")),
      updatedAt: new Date(),
    })
    .where(eq(locations.id, id));

  revalidatePath("/locations");
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const str = value ? String(value).trim() : "";
  return str.length ? str : null;
}
