/**
 * One-off: give an already-migrated (profile-only, loginEnabled=false)
 * user a real Supabase Auth account, using Supabase's documented ability
 * to set a specific `id` on createUser — so the new auth account lines
 * up with the existing public.users row (and everything that already
 * references it: departments.managerId, assets.assignedToUserId, etc.)
 * with zero foreign-key changes needed.
 *
 * Run: node --env-file=.env.local --import tsx src/db/seed/provision-login-for-existing-user.ts <userId> <password>
 */
import { eq } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";
import { db } from "../client";
import { users } from "../schema/core";

async function main() {
  const [userId, password] = process.argv.slice(2);
  if (!userId || !password) {
    console.error("Usage: provision-login-for-existing-user.ts <userId> <password>");
    process.exit(1);
  }

  const [existing] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!existing) throw new Error(`No public.users row with id ${userId}`);

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error } = await supabaseAdmin.auth.admin.createUser({
    id: userId,
    email: existing.email,
    password,
    email_confirm: true,
  });
  if (error) throw error;

  await db.update(users).set({ loginEnabled: true }).where(eq(users.id, userId));

  console.log(`Provisioned login for ${existing.email} (id: ${userId})`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
