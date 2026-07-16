"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { logEvent } from "@/lib/audit";
import { db } from "@/db/client";

export async function logout() {
  const user = await getCurrentUser();

  const supabase = await createClient();
  await supabase.auth.signOut();

  if (user) {
    await logEvent(db, {
      companyId: user.companyId,
      actorUserId: user.id,
      actionType: "user.logout",
      targetType: "user",
      targetId: user.id,
      meta: {},
    });
  }

  redirect("/login");
}
