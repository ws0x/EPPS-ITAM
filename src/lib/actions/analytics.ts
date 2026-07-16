"use server";

import { eq, and, sql, isNotNull } from "drizzle-orm";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/db/client";
import { assets, models, categories, statusLabels, licenses, checkouts } from "@/db/schema";

export async function getUtilizationByStatus() {
  const user = await requireUser();
  return db
    .select({
      name: statusLabels.name,
      color: statusLabels.color,
      count: sql<number>`count(*)::int`,
    })
    .from(assets)
    .innerJoin(statusLabels, eq(assets.statusId, statusLabels.id))
    .where(eq(assets.companyId, user.companyId))
    .groupBy(statusLabels.name, statusLabels.color)
    .orderBy(sql`count(*) desc`);
}

export async function getAssetCountByCategory() {
  const user = await requireUser();
  return db
    .select({
      name: categories.name,
      count: sql<number>`count(*)::int`,
    })
    .from(assets)
    .innerJoin(models, eq(assets.modelId, models.id))
    .innerJoin(categories, eq(models.categoryId, categories.id))
    .where(eq(assets.companyId, user.companyId))
    .groupBy(categories.name)
    .orderBy(sql`count(*) desc`)
    .limit(10);
}

export async function getValueByCategory() {
  const user = await requireUser();
  const rows = await db
    .select({
      name: categories.name,
      total: sql<string>`coalesce(sum(${assets.purchaseCost}), 0)`,
    })
    .from(assets)
    .innerJoin(models, eq(assets.modelId, models.id))
    .innerJoin(categories, eq(models.categoryId, categories.id))
    .where(eq(assets.companyId, user.companyId))
    .groupBy(categories.name)
    .orderBy(sql`sum(${assets.purchaseCost}) desc nulls last`)
    .limit(10);
  return rows.map((r) => ({ name: r.name, total: Number(r.total) })).filter((r) => r.total > 0);
}

export type ExpiryBucket = "expired" | "30" | "60" | "90" | "later";

export async function getLicenseExpiryForecast() {
  const user = await requireUser();
  const rows = await db
    .select({ name: licenses.name, expiresAt: licenses.expiresAt })
    .from(licenses)
    .where(and(eq(licenses.companyId, user.companyId), isNotNull(licenses.expiresAt)));

  const today = new Date();
  const buckets: Record<ExpiryBucket, number> = { expired: 0, "30": 0, "60": 0, "90": 0, later: 0 };
  const upcoming: { name: string; expiresAt: string; daysUntil: number }[] = [];

  for (const row of rows) {
    if (!row.expiresAt) continue;
    const expires = new Date(row.expiresAt);
    const daysUntil = Math.ceil((expires.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil < 0) buckets.expired++;
    else if (daysUntil <= 30) buckets["30"]++;
    else if (daysUntil <= 60) buckets["60"]++;
    else if (daysUntil <= 90) buckets["90"]++;
    else buckets.later++;

    if (daysUntil <= 90) {
      upcoming.push({ name: row.name, expiresAt: row.expiresAt, daysUntil });
    }
  }

  upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
  return { buckets, upcoming };
}

export async function getWarrantyExpiryForecast() {
  const user = await requireUser();
  const rows = await db
    .select({ assetTag: assets.assetTag, name: assets.name, warrantyExpiresAt: assets.warrantyExpiresAt })
    .from(assets)
    .where(and(eq(assets.companyId, user.companyId), isNotNull(assets.warrantyExpiresAt)));

  const today = new Date();
  const upcoming = rows
    .map((r) => ({
      label: r.name ?? r.assetTag,
      expiresAt: r.warrantyExpiresAt!,
      daysUntil: Math.ceil((new Date(r.warrantyExpiresAt!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
    }))
    .filter((r) => r.daysUntil <= 90)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  return upcoming;
}

export async function getAuditCompliance() {
  const user = await requireUser();
  const today = new Date().toISOString().slice(0, 10);

  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      overdue: sql<number>`count(*) filter (where ${assets.nextAuditDate} < ${today})::int`,
      upcoming: sql<number>`count(*) filter (where ${assets.nextAuditDate} >= ${today})::int`,
      neverScheduled: sql<number>`count(*) filter (where ${assets.nextAuditDate} is null)::int`,
    })
    .from(assets)
    .where(eq(assets.companyId, user.companyId));

  return row ?? { total: 0, overdue: 0, upcoming: 0, neverScheduled: 0 };
}

export async function getCheckoutTurnaround() {
  await requireUser();
  const [row] = await db
    .select({
      avgDays: sql<string>`coalesce(avg(extract(epoch from (${checkouts.checkedInAt} - ${checkouts.checkedOutAt})) / 86400), 0)`,
      completedCount: sql<number>`count(*)::int`,
    })
    .from(checkouts)
    .where(isNotNull(checkouts.checkedInAt));

  return {
    avgDays: Number(row?.avgDays ?? 0),
    completedCount: row?.completedCount ?? 0,
  };
}
