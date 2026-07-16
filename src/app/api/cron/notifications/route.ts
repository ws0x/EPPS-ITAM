import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { companies } from "@/db/schema";
import { runAllDigestsForCompany } from "@/lib/notifications";

/**
 * Vercel Cron target for Phase K's digests (see vercel.json). Not actually
 * live yet, on purpose: 401s unless CRON_SECRET is set to match the request
 * (Vercel's own recommended pattern for protecting cron routes -
 * https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs),
 * and even a real invocation only logs failed sends to notification_log
 * since RESEND_API_KEY is unset too. Activating this for real is two env
 * vars in Vercel, not a code change.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allCompanies = await db.select({ id: companies.id }).from(companies);

  const results = await Promise.all(
    allCompanies.map(async (c) => ({ companyId: c.id, result: await runAllDigestsForCompany(c.id) }))
  );

  return NextResponse.json({ ranAt: new Date().toISOString(), companies: results.length, results });
}
