"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/db/client";
import { companies } from "@/db/schema";
import { logUpdate } from "@/lib/audit";

export async function getCompanyLetterhead() {
  const user = await requireUser();
  const [row] = await db.select().from(companies).where(eq(companies.id, user.companyId)).limit(1);
  return row ?? null;
}

export type ActionState = { error?: string; success?: boolean } | undefined;

export async function updateCompanyLetterhead(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  requirePermission(user, "company:*");

  const [before] = await db.select().from(companies).where(eq(companies.id, user.companyId)).limit(1);
  if (!before) return { error: "Company not found." };

  const [after] = await db
    .update(companies)
    .set({
      letterheadNameLine1: emptyToNull(formData.get("letterheadNameLine1")),
      letterheadNameLine2: emptyToNull(formData.get("letterheadNameLine2")),
      letterheadTagline: emptyToNull(formData.get("letterheadTagline")),
      letterheadOfficePhone: emptyToNull(formData.get("letterheadOfficePhone")),
      letterheadMobilePhone: emptyToNull(formData.get("letterheadMobilePhone")),
      letterheadFax: emptyToNull(formData.get("letterheadFax")),
      letterheadEmails: emptyToNull(formData.get("letterheadEmails")),
      letterheadWebsite: emptyToNull(formData.get("letterheadWebsite")),
      letterheadAddress: emptyToNull(formData.get("letterheadAddress")),
      updatedAt: new Date(),
    })
    .where(eq(companies.id, user.companyId))
    .returning();

  await logUpdate(db, {
    companyId: user.companyId,
    actorUserId: user.id,
    targetType: "company",
    targetId: user.companyId,
    before,
    after,
  });

  revalidatePath("/settings/company");
  return { success: true };
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const str = value ? String(value).trim() : "";
  return str.length ? str : null;
}
