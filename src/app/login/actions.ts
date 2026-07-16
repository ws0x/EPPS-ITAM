"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { logEvent } from "@/lib/audit";

const LoginSchema = z.object({
  email: z.email({ error: "Enter a valid email." }),
  password: z.string().min(1, { error: "Password is required." }),
});

export type LoginState = { error?: string } | undefined;

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Only log failed attempts against a known account - a completely
    // unknown email isn't tied to any real user/company row to log against,
    // and has lower security value than tracking repeated failures on a
    // real account.
    const [knownUser] = await db
      .select({ id: users.id, companyId: users.companyId })
      .from(users)
      .where(eq(users.email, parsed.data.email.toLowerCase()))
      .limit(1);
    if (knownUser) {
      await logEvent(db, {
        companyId: knownUser.companyId,
        actorUserId: knownUser.id,
        actionType: "user.login_failed",
        targetType: "user",
        targetId: knownUser.id,
        meta: {},
      });
    }
    return { error: "Invalid email or password." };
  }

  const [signedInUser] = await db
    .select({ id: users.id, companyId: users.companyId })
    .from(users)
    .where(eq(users.id, data.user.id))
    .limit(1);
  if (signedInUser) {
    await logEvent(db, {
      companyId: signedInUser.companyId,
      actorUserId: signedInUser.id,
      actionType: "user.login",
      targetType: "user",
      targetId: signedInUser.id,
      meta: {},
    });
  }

  const redirectTo = String(formData.get("redirectTo") || "/dashboard");
  redirect(redirectTo);
}
