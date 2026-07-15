/**
 * Follow-up migration pass: Licenses, License Seats, Consumables, Kits,
 * and historical checkout acceptances (EULA e-signatures) — the items
 * intentionally deferred by migrate.ts (see its header comment and
 * BACKLOG.md item 7). Same dry-run-by-default / --commit convention.
 *
 * Key difference from migrate.ts: that script resolved FKs via an
 * in-memory ID map built during its own single run. This script runs
 * *after* migrate.ts already committed, so the only way to link back to
 * already-migrated rows is by natural key — asset_tag (copied verbatim
 * from legacy), user email, manufacturer/category name, and model
 * (name + category + manufacturer, since model name alone isn't unique).
 *
 * Deliberately out of scope (negligible volume, not worth the added
 * resolution complexity — see the counts logged below): the 3
 * LicenseSeat-type and 1 Consumable-type legacy checkout_acceptances
 * rows (of 1,132 total; the other 1,128 are Asset-type and are migrated).
 * consumables_users (consumable assignment history) is empty in the
 * source dump — nothing to migrate there.
 *
 * NOT IDEMPOTENT — same as migrate.ts. This has already been run once
 * with --commit against the real database (25 licenses, 970 seats, 22
 * consumables, 4 kits, 5 kit items, 479 synthesized checkouts+acceptances,
 * all verified against the DB afterward). Re-running --commit would
 * insert duplicates of all of that, not skip already-migrated rows.
 *
 * Run: node --env-file=.env.local --import tsx migration/migrate-followup.ts [--commit]
 */
import { loadDump, extractTable, dateOrNull, int, type LegacyRow } from "./lib/sql-parser.mjs";
import { db } from "../src/db/client";
import {
  companies,
  categories,
  manufacturers,
  users,
  roles,
  assets,
  models,
  licenses,
  licenseSeats,
  consumables,
  kits,
  kitItems,
  checkouts,
  acceptances,
} from "../src/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

const COMMIT = process.argv.includes("--commit");
const sql = loadDump("./migration/snipeit-backup.sql");

// One legacy license (Windows 10, #1) references "Operating System" — a
// category already excluded from the v1 taxonomy as a soft-deleted
// duplicate superseded by "Microsoft Windows" (see BACKLOG.md item 6).
// Same shape as migrate.ts's CATEGORY_REMAP, scoped to licenses here.
const LICENSE_CATEGORY_REMAP: Record<string, string> = {
  "Operating System": "Microsoft Windows",
};

async function main() {
  console.log(COMMIT ? "=== COMMIT MODE ===" : "=== DRY RUN (no writes) ===");

  const [company] = await db.select().from(companies).limit(1);
  if (!company) throw new Error("No company found — run db:seed first.");

  const [adminRole] = await db.select().from(roles).where(eq(roles.name, "admin")).limit(1);
  if (!adminRole) throw new Error("No 'admin' role found.");
  const [adminUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.roleId, adminRole.id))
    .limit(1);
  if (!adminUser) throw new Error("No admin user found — needed as a fallback 'checked out by' actor for historical records with no recorded actor.");

  // ---- Natural-key lookups against the already-migrated DB ----
  const dbCategories = await db.select().from(categories).where(eq(categories.companyId, company.id));
  const categoryIdByName = new Map(dbCategories.map((c) => [c.name.trim().toLowerCase(), c.id]));

  const dbManufacturers = await db.select().from(manufacturers).where(eq(manufacturers.companyId, company.id));
  const manufacturerIdByName = new Map(dbManufacturers.map((m) => [m.name.trim().toLowerCase(), m.id]));

  const dbUsers = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.companyId, company.id));
  const userIdByEmail = new Map(dbUsers.map((u) => [u.email.toLowerCase(), u.id]));

  const dbAssets = await db.select({ id: assets.id, assetTag: assets.assetTag }).from(assets).where(eq(assets.companyId, company.id));
  const assetIdByTag = new Map(dbAssets.map((a) => [a.assetTag, a.id]));

  const dbModels = await db
    .select({ id: models.id, name: models.name, categoryId: models.categoryId, manufacturerId: models.manufacturerId })
    .from(models)
    .where(eq(models.companyId, company.id));
  const modelIdByKey = new Map(
    dbModels.map((m) => [`${m.name.trim().toLowerCase()}|${m.categoryId}|${m.manufacturerId ?? "none"}`, m.id]),
  );

  // ---- Parse legacy tables ----
  const legacyLicenses = extractTable(sql, "licenses");
  const legacyLicenseSeats = extractTable(sql, "license_seats");
  const legacyConsumables = extractTable(sql, "consumables");
  const legacyKits = extractTable(sql, "kits");
  const legacyKitsModels = extractTable(sql, "kits_models");
  const legacyAcceptances = extractTable(sql, "checkout_acceptances");
  const legacyCategories = extractTable(sql, "categories");
  const legacyManufacturers = extractTable(sql, "manufacturers");
  const legacyUsers = extractTable(sql, "users");
  const legacyAssets = extractTable(sql, "assets");
  const legacyModels = extractTable(sql, "models");

  const legacyCategoryById = new Map(legacyCategories.map((c) => [c.id, c]));
  const legacyManufacturerById = new Map(legacyManufacturers.map((m) => [m.id, m]));
  const legacyUserById = new Map(legacyUsers.map((u) => [u.id, u]));
  const legacyAssetById = new Map(legacyAssets.map((a) => [a.id, a]));
  const legacyModelById = new Map(legacyModels.map((m) => [m.id, m]));

  function resolveCategoryId(legacyCategoryId: string | null, remap: Record<string, string> = {}): string | null {
    if (!legacyCategoryId) return null;
    const cat = legacyCategoryById.get(legacyCategoryId);
    if (!cat?.name) return null;
    const name = remap[cat.name] ?? cat.name;
    return categoryIdByName.get(name.trim().toLowerCase()) ?? null;
  }

  function resolveManufacturerId(legacyManufacturerId: string | null): string | null {
    if (!legacyManufacturerId) return null;
    const man = legacyManufacturerById.get(legacyManufacturerId);
    if (!man?.name) return null;
    return manufacturerIdByName.get(man.name.trim().toLowerCase()) ?? null;
  }

  function resolveUserId(legacyUserId: string | null): string | null {
    if (!legacyUserId) return null;
    const u = legacyUserById.get(legacyUserId);
    if (!u) return null;
    // migrate.ts gave every legacy user *some* email — a synthetic
    // legacy-{id}@migrated.invalid one for accounts with none (mostly
    // shared/service identities). Match that same fallback here, or a
    // real service-account user simply won't resolve.
    const email = (u.email || `legacy-${u.id}@migrated.invalid`).toLowerCase();
    return userIdByEmail.get(email) ?? null;
  }

  function resolveAssetId(legacyAssetId: string | null): string | null {
    if (!legacyAssetId) return null;
    const a = legacyAssetById.get(legacyAssetId);
    if (!a?.asset_tag) return null;
    return assetIdByTag.get(a.asset_tag) ?? null;
  }

  function resolveModelId(legacyModelId: string | null): string | null {
    if (!legacyModelId) return null;
    const m = legacyModelById.get(legacyModelId);
    if (!m?.name) return null;
    const categoryId = resolveCategoryId(m.category_id);
    if (!categoryId) return null;
    const manufacturerId = resolveManufacturerId(m.manufacturer_id);
    const key = `${m.name.trim().toLowerCase()}|${categoryId}|${manufacturerId ?? "none"}`;
    return modelIdByKey.get(key) ?? null;
  }

  // ==================== Licenses ====================
  const licenseIdMap = new Map<string, string>();
  let skippedLicenseNoCategory = 0;
  const licenseInserts = legacyLicenses
    .map((l: LegacyRow) => {
      const categoryId = resolveCategoryId(l.category_id, LICENSE_CATEGORY_REMAP);
      if (!categoryId) {
        skippedLicenseNoCategory++;
        return null;
      }
      const newId = randomUUID();
      licenseIdMap.set(l.id!, newId);
      return {
        id: newId,
        companyId: company.id,
        categoryId,
        manufacturerId: resolveManufacturerId(l.manufacturer_id),
        name: l.name ?? l.license_name ?? `Unknown license #${l.id}`,
        licenseKey: l.serial,
        seatsTotal: int(l.seats) ?? 1,
        purchaseDate: dateOrNull(l.purchase_date),
        purchaseCost: l.purchase_cost,
        expiresAt: dateOrNull(l.expiration_date),
        notes: l.notes,
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);
  console.log(`\nLicenses: ${licenseInserts.length} to migrate (${skippedLicenseNoCategory} skipped — no resolvable category)`);

  // ==================== License Seats ====================
  let skippedSeatNoLicense = 0;
  const licenseSeatInserts = legacyLicenseSeats
    .map((s: LegacyRow) => {
      const licenseId = s.license_id ? licenseIdMap.get(s.license_id) : undefined;
      if (!licenseId) {
        skippedSeatNoLicense++;
        return null;
      }
      return {
        licenseId,
        assignedToUserId: resolveUserId(s.assigned_to),
        assignedToAssetId: resolveAssetId(s.asset_id),
        notes: s.notes,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);
  console.log(`License seats: ${licenseSeatInserts.length} to migrate (${skippedSeatNoLicense} skipped — parent license not migrated)`);

  // ==================== Consumables ====================
  let skippedConsumableNoCategory = 0;
  const consumableInserts = legacyConsumables
    .map((c: LegacyRow) => {
      const categoryId = resolveCategoryId(c.category_id);
      if (!categoryId) {
        skippedConsumableNoCategory++;
        return null;
      }
      return {
        companyId: company.id,
        categoryId,
        manufacturerId: resolveManufacturerId(c.manufacturer_id),
        name: c.name ?? `Unknown consumable #${c.id}`,
        modelNumber: c.model_number,
        qtyTotal: int(c.qty) ?? 0,
        minQty: int(c.min_amt) ?? 0,
        purchaseCost: c.purchase_cost,
        notes: c.notes,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);
  console.log(`Consumables: ${consumableInserts.length} to migrate (${skippedConsumableNoCategory} skipped — no resolvable category)`);

  // ==================== Kits + Kit Items (models only — kits_accessories/consumables/licenses are empty in this dump) ====================
  const kitIdMap = new Map<string, string>();
  const kitInserts = legacyKits.map((k: LegacyRow) => {
    const newId = randomUUID();
    kitIdMap.set(k.id!, newId);
    return { id: newId, companyId: company.id, name: k.name ?? `Unknown kit #${k.id}`, notes: null };
  });
  console.log(`Kits: ${kitInserts.length} to migrate`);

  let skippedKitItemNoModel = 0;
  const kitItemInserts = legacyKitsModels
    .map((ki: LegacyRow) => {
      const kitId = ki.kit_id ? kitIdMap.get(ki.kit_id) : undefined;
      const itemId = resolveModelId(ki.model_id);
      if (!kitId || !itemId) {
        skippedKitItemNoModel++;
        return null;
      }
      return { kitId, itemType: "model" as const, itemId, quantity: int(ki.quantity) ?? 1 };
    })
    .filter((ki): ki is NonNullable<typeof ki> => ki !== null);
  console.log(`Kit items: ${kitItemInserts.length} to migrate (${skippedKitItemNoModel} skipped — kit or model not resolvable)`);

  // ==================== Checkout acceptances -> synthetic checkouts + acceptances ====================
  // Snipe-IT has no discrete "checkout event" log — assignment is a
  // column on the asset itself. So for each historical acceptance we
  // synthesize one checkouts row to hang the acceptance off, using the
  // acceptance's own timestamps as a best-effort checkedOutAt. There is
  // no recorded "who processed this checkout" in the source data, so
  // checkedOutByUserId falls back to the admin account — a documented
  // limitation, not a guess dressed up as fact.
  const assetAcceptances = legacyAcceptances.filter((a: LegacyRow) => a.checkoutable_type === "App\\Models\\Asset");
  const skippedTypes = legacyAcceptances.length - assetAcceptances.length;

  let skippedAcceptanceNoAsset = 0;
  let skippedAcceptanceNoUser = 0;
  const acceptanceInserts: {
    checkout: typeof checkouts.$inferInsert;
    acceptance: Omit<typeof acceptances.$inferInsert, "checkoutId">;
  }[] = [];

  for (const a of assetAcceptances) {
    const assetId = resolveAssetId(a.checkoutable_id);
    if (!assetId) {
      skippedAcceptanceNoAsset++;
      continue;
    }
    const assignedToUserId = resolveUserId(a.assigned_to_id);
    if (!assignedToUserId) {
      skippedAcceptanceNoUser++;
      continue;
    }
    const checkedOutAt = dateOrNull(a.created_at) ?? dateOrNull(a.accepted_at) ?? new Date().toISOString();
    const status = a.accepted_at ? "accepted" : a.declined_at ? "declined" : "pending";

    acceptanceInserts.push({
      checkout: {
        checkoutableType: "asset",
        checkoutableId: assetId,
        assignedToUserId,
        checkedOutByUserId: adminUser.id,
        checkedOutAt: new Date(checkedOutAt),
        notes: "Migrated from legacy checkout_acceptances (no discrete checkout log existed in the source system).",
      },
      acceptance: {
        status,
        eulaSnapshot: a.stored_eula,
        note: a.note,
        acceptedAt: dateOrNull(a.accepted_at) ? new Date(dateOrNull(a.accepted_at)!) : null,
        declinedAt: dateOrNull(a.declined_at) ? new Date(dateOrNull(a.declined_at)!) : null,
      },
    });
  }
  console.log(
    `Checkout acceptances: ${acceptanceInserts.length} to migrate (${skippedTypes} skipped — non-Asset type [3 LicenseSeat + 1 Consumable, deliberately out of scope], ${skippedAcceptanceNoAsset} skipped — asset not migrated, ${skippedAcceptanceNoUser} skipped — user not migrated)`,
  );

  // ==================== Commit ====================
  if (COMMIT) {
    await db.transaction(async (tx) => {
      if (licenseInserts.length) await tx.insert(licenses).values(licenseInserts);
      if (licenseSeatInserts.length) await tx.insert(licenseSeats).values(licenseSeatInserts);
      if (consumableInserts.length) await tx.insert(consumables).values(consumableInserts);
      if (kitInserts.length) await tx.insert(kits).values(kitInserts);
      if (kitItemInserts.length) await tx.insert(kitItems).values(kitItemInserts);

      for (const { checkout, acceptance } of acceptanceInserts) {
        const [newCheckout] = await tx.insert(checkouts).values(checkout).returning({ id: checkouts.id });
        await tx.insert(acceptances).values({ ...acceptance, checkoutId: newCheckout.id });
      }
    });
    console.log("\nAll follow-up data committed (one transaction).");
  }

  console.log(COMMIT ? "\n=== COMMIT COMPLETE ===" : "\n=== DRY RUN COMPLETE — pass --commit to write ===");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
