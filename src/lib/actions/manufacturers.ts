"use server";

import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/db/client";
import { manufacturers } from "@/db/schema";
import { logCreate, logUpdate } from "@/lib/audit";

export async function listManufacturers() {
  const user = await requireUser();
  return db
    .select()
    .from(manufacturers)
    .where(eq(manufacturers.companyId, user.companyId))
    .orderBy(asc(manufacturers.name));
}

export type ActionState = { error?: string } | undefined;

export async function createManufacturer(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  requirePermission(user, "assets:*");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  const [newManufacturer] = await db
    .insert(manufacturers)
    .values({
      companyId: user.companyId,
      name,
      supportUrl: emptyToNull(formData.get("supportUrl")),
      supportPhone: emptyToNull(formData.get("supportPhone")),
    })
    .returning();

  await logCreate(db, {
    companyId: user.companyId,
    actorUserId: user.id,
    targetType: "manufacturer",
    targetId: newManufacturer.id,
    row: newManufacturer,
  });

  revalidatePath("/manufacturers");
}

export async function updateManufacturer(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  requirePermission(user, "assets:*");

  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  const [before] = await db.select().from(manufacturers).where(eq(manufacturers.id, id)).limit(1);
  if (!before) return { error: "Manufacturer not found." };

  const [after] = await db
    .update(manufacturers)
    .set({
      name,
      supportUrl: emptyToNull(formData.get("supportUrl")),
      supportPhone: emptyToNull(formData.get("supportPhone")),
    })
    .where(eq(manufacturers.id, id))
    .returning();

  await logUpdate(db, {
    companyId: user.companyId,
    actorUserId: user.id,
    targetType: "manufacturer",
    targetId: id,
    before,
    after,
  });

  revalidatePath("/manufacturers");
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const str = value ? String(value).trim() : "";
  return str.length ? str : null;
}
