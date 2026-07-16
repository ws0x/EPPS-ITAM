"use server";

import { ilike, or, eq, and, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { assets, users, licenses, consumables, kits, purchaseOrders } from "@/db/schema";
import { requireUser } from "@/lib/auth/dal";

export type SearchResult = {
  id: string;
  type: "asset" | "user" | "license" | "consumable" | "kit" | "purchaseOrder";
  title: string;
  subtitle: string;
  url: string;
};

export async function globalSearchAction(query: string): Promise<SearchResult[]> {
  const currentUser = await requireUser();
  const q = `%${query.trim()}%`;
  
  if (!query || query.trim().length < 2) {
    return [];
  }

  const results: SearchResult[] = [];

  // Search Assets (max 5)
  const matchedAssets = await db
    .select({
      id: assets.id,
      name: assets.name,
      assetTag: assets.assetTag,
      serial: assets.serial,
    })
    .from(assets)
    .where(
      and(
        eq(assets.companyId, currentUser.companyId),
        or(
          ilike(assets.name, q),
          ilike(assets.assetTag, q),
          ilike(assets.serial, q)
        )
      )
    )
    .limit(5);

  for (const a of matchedAssets) {
    results.push({
      id: a.id,
      type: "asset",
      title: a.assetTag,
      subtitle: a.name || a.serial || "Unknown Asset",
      url: `/assets/${a.id}`,
    });
  }

  // Search Users (max 5)
  const matchedUsers = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    })
    .from(users)
    .where(
      and(
        eq(users.companyId, currentUser.companyId),
        or(
          ilike(users.firstName, q),
          ilike(users.lastName, q),
          ilike(users.email, q)
        )
      )
    )
    .limit(5);

  for (const u of matchedUsers) {
    const fullName = `${u.firstName || ""} ${u.lastName || ""}`.trim();
    results.push({
      id: u.id,
      type: "user",
      title: fullName || u.email,
      subtitle: u.email,
      url: `/users/${u.id}`,
    });
  }

  // Search Licenses (max 5)
  const matchedLicenses = await db
    .select({
      id: licenses.id,
      name: licenses.name,
      licenseKey: licenses.licenseKey,
    })
    .from(licenses)
    .where(
      and(
        eq(licenses.companyId, currentUser.companyId),
        or(
          ilike(licenses.name, q),
          ilike(licenses.licenseKey, q)
        )
      )
    )
    .limit(5);

  for (const l of matchedLicenses) {
    results.push({
      id: l.id,
      type: "license",
      title: l.name,
      subtitle: l.licenseKey ? `Key: ${l.licenseKey}` : "No key provided",
      url: `/licenses/${l.id}`,
    });
  }

  // Search Consumables (max 5)
  const matchedConsumables = await db
    .select({
      id: consumables.id,
      name: consumables.name,
      qtyTotal: consumables.qtyTotal,
    })
    .from(consumables)
    .where(and(eq(consumables.companyId, currentUser.companyId), ilike(consumables.name, q)))
    .limit(5);

  for (const c of matchedConsumables) {
    results.push({
      id: c.id,
      type: "consumable",
      title: c.name,
      subtitle: `${c.qtyTotal} in stock`,
      url: `/consumables/${c.id}`,
    });
  }

  // Search Kits (max 5)
  const matchedKits = await db
    .select({
      id: kits.id,
      name: kits.name,
    })
    .from(kits)
    .where(and(eq(kits.companyId, currentUser.companyId), ilike(kits.name, q)))
    .limit(5);

  for (const k of matchedKits) {
    results.push({
      id: k.id,
      type: "kit",
      title: k.name,
      subtitle: "Kit",
      url: `/kits/${k.id}`,
    });
  }

  // Search Purchase Orders (max 5)
  const matchedPos = await db
    .select({
      id: purchaseOrders.id,
      poNumber: purchaseOrders.poNumber,
      supplierName: purchaseOrders.supplierName,
    })
    .from(purchaseOrders)
    .where(
      and(
        eq(purchaseOrders.companyId, currentUser.companyId),
        or(ilike(purchaseOrders.poNumber, q), ilike(purchaseOrders.supplierName, q)),
      ),
    )
    .limit(5);

  for (const po of matchedPos) {
    results.push({
      id: po.id,
      type: "purchaseOrder",
      title: po.poNumber,
      subtitle: po.supplierName,
      url: `/purchase-orders/${po.id}`,
    });
  }

  return results;
}
