/**
 * One-off script to create the first admin account: a Supabase Auth user
 * plus the matching public.users row (role = admin). Run with:
 *   node --env-file=.env.local --import tsx src/db/seed/provision-admin.ts <email> <password>
 * Requires SUPABASE_SERVICE_ROLE_KEY (bypasses email confirmation).
 */
import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { db } from "../client";
import { users, roles, companies } from "../schema/core";

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Usage: provision-admin.ts <email> <password>");
    process.exit(1);
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;

  const [company] = await db.select().from(companies).limit(1);
  if (!company) throw new Error("No company found - run db:seed first.");

  const [adminRole] = await db.select().from(roles).where(eq(roles.name, "admin")).limit(1);
  if (!adminRole) throw new Error("No 'admin' role found - run db:seed first.");

  await db.insert(users).values({
    id: data.user.id,
    companyId: company.id,
    roleId: adminRole.id,
    email,
    username: email.split("@")[0],
    loginEnabled: true,
  });

  console.log(`Admin account created: ${email} (id: ${data.user.id})`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
