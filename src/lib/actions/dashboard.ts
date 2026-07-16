"use server";

import { eq, and, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/db/client";
import { assets, statusLabels, users } from "@/db/schema";

export async function getDashboardStats() {
  const user = await requireUser();

  const [assetCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(assets)
    .where(eq(assets.companyId, user.companyId));

  const [deployedCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(assets)
    .innerJoin(statusLabels, eq(assets.statusId, statusLabels.id))
    .where(and(eq(assets.companyId, user.companyId), eq(statusLabels.name, "Deployed")));

  const [totalValue] = await db
    .select({ total: sql<string>`coalesce(sum(${assets.purchaseCost}), 0)` })
    .from(assets)
    .where(eq(assets.companyId, user.companyId));

  const [userCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.companyId, user.companyId));

  return {
    totalAssets: assetCount?.count ?? 0,
    deployedAssets: deployedCount?.count ?? 0,
    totalValue: Number(totalValue?.total ?? 0),
    totalUsers: userCount?.count ?? 0,
  };
}
