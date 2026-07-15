/**
 * Legacy Snipe-IT -> ITAM migration. Dry-run by default (reports what
 * would happen, writes nothing); pass --commit to actually insert.
 *
 * Scope of this pass: Locations, Departments, Users (profile rows only,
 * loginEnabled=false, no Supabase Auth accounts — per explicit decision),
 * Manufacturers, Suppliers, Models, Assets. Licenses/Consumables/Kits/
 * Checkout-history-reconstruction/Acceptances/Audit-logs are a deliberate
 * follow-up pass, not attempted here — see BACKLOG.md.
 *
 * Reference data (Locations/Departments/Users/Manufacturers/Suppliers/
 * Models) runs in one transaction — a failure partway through must not
 * leave orphaned rows with no downstream data pointing at them (this bit
 * us once already: a username collision mid-run left 39 locations + 21
 * departments committed with nothing referencing them yet). Assets run
 * separately with per-row fallback on failure, since a handful of bad
 * asset_tag collisions shouldn't sink 1,600+ good rows.
 *
 * Run: node --env-file=.env.local --import tsx migration/migrate.ts [--commit]
 */
import { loadDump, extractTable, dateOrNull, type LegacyRow } from "./lib/sql-parser.mjs";
import { db } from "../src/db/client";
import {
  companies,
  locations,
  departments,
  users,
  roles,
  categories,
  statusLabels,
  manufacturers,
  suppliers,
  models,
  assets,
} from "../src/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

const COMMIT = process.argv.includes("--commit");
const sql = loadDump("./migration/snipeit-backup.sql");

// Legacy status name -> clean v1 status name. Several legacy rows are
// soft-deleted duplicates/experiments from prior cleanup passes (see
// BACKLOG.md item 7) — map them onto the 5 clean seeded labels.
const STATUS_REMAP: Record<string, string> = {
  Pending: "Pending",
  "Ready to Deploy": "Ready to Deploy",
  Archived: "Archived",
  Deployed: "Deployed",
  "Under Maintenance": "Under Maintenance",
  "Form Template": "Pending",
  "Deployed Deployed": "Deployed",
  "Ready for Deploy": "Ready to Deploy",
  "Un-deployable": "Under Maintenance",
  "Ready to Deploy - Issued": "Ready to Deploy",
};

// The one asset-category name that has no active legacy equivalent
// (confirmed via migration/check-category-coverage.mjs --include-deleted).
const CATEGORY_REMAP: Record<string, string> = {
  "Wireless Mouse": "Mouse",
};

async function main() {
  console.log(COMMIT ? "=== COMMIT MODE ===" : "=== DRY RUN (no writes) ===");

  const [company] = await db.select().from(companies).limit(1);
  if (!company) throw new Error("No company found — run db:seed first.");

  const dbCategories = await db.select().from(categories).where(eq(categories.companyId, company.id));
  const categoryIdByName = new Map(dbCategories.map((c) => [c.name.trim().toLowerCase(), c.id]));

  const dbStatuses = await db.select().from(statusLabels).where(eq(statusLabels.companyId, company.id));
  const statusIdByName = new Map(dbStatuses.map((s) => [s.name, s.id]));

  const [employeeRole] = await db.select().from(roles).where(eq(roles.name, "employee")).limit(1);
  if (!employeeRole) throw new Error("No 'employee' role found — run db:seed first.");

  const existingUsers = await db.select({ username: users.username }).from(users).where(eq(users.companyId, company.id));
  const seenUsernames = new Set<string>(existingUsers.map((u) => u.username));

  // ---- Parse legacy tables ----
  const legacyLocations = extractTable(sql, "locations");
  const legacyDepartments = extractTable(sql, "departments");
  const legacyUsers = extractTable(sql, "users");
  const legacyManufacturers = extractTable(sql, "manufacturers");
  const legacySuppliers = extractTable(sql, "suppliers");
  const legacyModels = extractTable(sql, "models");
  const legacyAssets = extractTable(sql, "assets");
  const legacyCategories = extractTable(sql, "categories");
  const legacyStatusLabels = extractTable(sql, "status_labels");

  const legacyCategoryById = new Map(legacyCategories.map((c) => [c.id, c]));
  const legacyStatusById = new Map(legacyStatusLabels.map((s) => [s.id, s]));

  // ==================== Locations ====================
  const locationIdMap = new Map<string, string>();
  const locationInserts = legacyLocations.map((l: LegacyRow) => {
    const newId = randomUUID();
    locationIdMap.set(l.id!, newId);
    return {
      id: newId,
      companyId: company.id,
      name: l.name ?? `Unknown location #${l.id}`,
      address: l.address,
      city: l.city,
      state: l.state,
      currency: l.currency ?? "EGP",
    };
  });
  console.log(`\nLocations: ${locationInserts.length} to migrate`);

  // ==================== Departments ====================
  const departmentIdMap = new Map<string, string>();
  const departmentInserts = legacyDepartments.map((d: LegacyRow) => {
    const newId = randomUUID();
    departmentIdMap.set(d.id!, newId);
    return {
      id: newId,
      companyId: company.id,
      name: d.name ?? `Unknown department #${d.id}`,
      notes: d.notes,
      defaultLocationId: d.location_id ? (locationIdMap.get(d.location_id) ?? null) : null,
    };
  });
  console.log(`Departments: ${departmentInserts.length} to migrate`);

  // ==================== Users (profile rows only) ====================
  const userIdMap = new Map<string, string>();
  const userInserts = legacyUsers.map((u: LegacyRow) => {
    const newId = randomUUID();
    userIdMap.set(u.id!, newId);

    let username = (u.username || u.email?.split("@")[0] || `user-${u.id}`).toLowerCase();
    let attempt = username;
    let n = 1;
    while (seenUsernames.has(attempt)) attempt = `${username}-${n++}`;
    username = attempt;
    seenUsernames.add(username);

    return {
      id: newId,
      companyId: company.id,
      departmentId: u.department_id ? (departmentIdMap.get(u.department_id) ?? null) : null,
      locationId: u.location_id ? (locationIdMap.get(u.location_id) ?? null) : null,
      roleId: employeeRole.id,
      email: u.email || `legacy-${u.id}@migrated.invalid`,
      username,
      firstName: u.first_name,
      lastName: u.last_name,
      jobTitle: u.jobtitle,
      phone: u.phone,
      employeeNumber: u.employee_num,
      notes: u.notes,
      isServiceAccount: !u.email,
      loginEnabled: false, // deliberate: profile-only migration, no Auth account yet
      deletedAt: (() => {
        const d = dateOrNull(u.deleted_at);
        return d ? new Date(d) : null;
      })(),
    };
  });
  console.log(`Users: ${userInserts.length} to migrate (all loginEnabled=false, no Auth accounts created)`);

  // ==================== Manufacturers ====================
  const manufacturerIdMap = new Map<string, string>();
  const manufacturerInserts = legacyManufacturers.map((m: LegacyRow) => {
    const newId = randomUUID();
    manufacturerIdMap.set(m.id!, newId);
    return { id: newId, companyId: company.id, name: m.name ?? `Unknown manufacturer #${m.id}`, supportUrl: m.support_url, supportPhone: m.support_phone };
  });
  console.log(`Manufacturers: ${manufacturerInserts.length} to migrate`);

  // ==================== Suppliers ====================
  const supplierIdMap = new Map<string, string>();
  const supplierInserts = legacySuppliers.map((s: LegacyRow) => {
    const newId = randomUUID();
    supplierIdMap.set(s.id!, newId);
    return { id: newId, companyId: company.id, name: s.name ?? `Unknown supplier #${s.id}`, contactEmail: s.email, contactPhone: s.phone, address: s.address };
  });
  console.log(`Suppliers: ${supplierInserts.length} to migrate`);

  // ==================== Models ====================
  function resolveCategoryId(legacyCategoryId: string | null): string | null {
    if (!legacyCategoryId) return null;
    const legacyCat = legacyCategoryById.get(legacyCategoryId);
    if (!legacyCat || !legacyCat.name) return null;
    const name = CATEGORY_REMAP[legacyCat.name] ?? legacyCat.name;
    return categoryIdByName.get(name.trim().toLowerCase()) ?? null;
  }

  const modelIdMap = new Map<string, string>();
  const unmappedModelCategories: string[] = [];
  const modelInserts = legacyModels
    .map((m: LegacyRow) => {
      const categoryId = resolveCategoryId(m.category_id);
      if (!categoryId) {
        unmappedModelCategories.push(`model ${m.id} (${m.name})`);
        return null;
      }
      const newId = randomUUID();
      modelIdMap.set(m.id!, newId);
      return {
        id: newId,
        companyId: company.id,
        categoryId,
        manufacturerId: m.manufacturer_id ? (manufacturerIdMap.get(m.manufacturer_id) ?? null) : null,
        name: m.name ?? `Unknown model #${m.id}`,
        modelNumber: m.model_number,
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  console.log(`Models: ${modelInserts.length} to migrate (${unmappedModelCategories.length} skipped — no resolvable category)`);
  if (unmappedModelCategories.length) {
    console.log("  Skipped:", unmappedModelCategories.slice(0, 20).join(", "));
  }

  // ==================== Reference data: one transaction ====================
  if (COMMIT) {
    await db.transaction(async (tx) => {
      await tx.insert(locations).values(locationInserts);
      for (const l of legacyLocations) {
        if (!l.parent_id) continue;
        const newParentId = locationIdMap.get(l.parent_id);
        const newId = locationIdMap.get(l.id!)!;
        if (newParentId) {
          await tx.update(locations).set({ parentLocationId: newParentId }).where(eq(locations.id, newId));
        }
      }

      await tx.insert(departments).values(departmentInserts);
      await tx.insert(users).values(userInserts);

      for (const u of legacyUsers) {
        if (!u.manager_id) continue;
        const newManagerId = userIdMap.get(u.manager_id);
        const newId = userIdMap.get(u.id!)!;
        if (newManagerId) {
          await tx.update(users).set({ managerId: newManagerId }).where(eq(users.id, newId));
        }
      }
      for (const d of legacyDepartments) {
        if (!d.manager_id) continue;
        const newManagerId = userIdMap.get(d.manager_id);
        const newId = departmentIdMap.get(d.id!)!;
        if (newManagerId) {
          await tx.update(departments).set({ managerId: newManagerId }).where(eq(departments.id, newId));
        }
      }

      await tx.insert(manufacturers).values(manufacturerInserts);
      await tx.insert(suppliers).values(supplierInserts);
      await tx.insert(models).values(modelInserts);
    });
    console.log("Reference data committed (one transaction).");
  }

  // ==================== Assets ====================
  let skippedNoModel = 0;
  let skippedNoStatus = 0;
  let skippedNoTag = 0;
  const assetInserts = legacyAssets
    .map((a: LegacyRow) => {
      const newModelId = modelIdMap.get(a.model_id ?? "");
      if (!newModelId) {
        skippedNoModel++;
        return null;
      }
      if (!a.asset_tag) {
        skippedNoTag++;
        return null;
      }
      const legacyStatus = a.status_id ? legacyStatusById.get(a.status_id) : undefined;
      const cleanStatusName = legacyStatus?.name ? (STATUS_REMAP[legacyStatus.name] ?? null) : null;
      const newStatusId = cleanStatusName ? statusIdByName.get(cleanStatusName) : undefined;
      if (!newStatusId) {
        skippedNoStatus++;
        return null;
      }

      const attributes: Record<string, string> = {};
      for (const [key, value] of Object.entries(a)) {
        if (key.startsWith("_snipeit_") && value !== null && value !== "") {
          const cleanKey = key.replace(/^_snipeit_/, "").replace(/_\d+$/, "");
          attributes[cleanKey] = value as string;
        }
      }

      return {
        companyId: company.id,
        modelId: newModelId,
        statusId: newStatusId,
        supplierId: a.supplier_id ? (supplierIdMap.get(a.supplier_id) ?? null) : null,
        assetTag: a.asset_tag, // guaranteed non-null by the guard above
        name: a.name,
        serial: a.serial,
        locationId: a.location_id ? (locationIdMap.get(a.location_id) ?? null) : null,
        rtdLocationId: a.rtd_location_id ? (locationIdMap.get(a.rtd_location_id) ?? null) : null,
        // Legacy "department" on assets was a free-text custom field
        // (_snipeit_department_16), not a real FK — it's preserved in
        // `attributes` above; there's no reliable link to a real
        // department row to set here.
        departmentId: null,
        assignedToUserId: a.assigned_type === "App\\Models\\User" && a.assigned_to ? (userIdMap.get(a.assigned_to) ?? null) : null,
        purchaseDate: dateOrNull(a.purchase_date),
        purchaseCost: a.purchase_cost,
        warrantyMonths: a.warranty_months ? Number.parseInt(a.warranty_months, 10) : null,
        warrantyExpiresAt: null, // legacy schema derives this; not a stored column pre-migration
        nextAuditDate: dateOrNull(a.next_audit_date),
        notes: a.notes,
        attributes,
        createdAt: a.created_at ? new Date(a.created_at) : new Date(),
        deletedAt: (() => {
          const d = dateOrNull(a.deleted_at);
          return d ? new Date(d) : null;
        })(),
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  console.log(
    `Assets: ${assetInserts.length} to migrate (${skippedNoModel} skipped — no model, ${skippedNoStatus} skipped — no status, ${skippedNoTag} skipped — no asset tag)`,
  );
  console.log("\nSample transformed asset:", JSON.stringify(assetInserts[0], null, 2));

  if (COMMIT) {
    // asset_tag has a unique constraint — insert in batches, report+skip collisions rather than aborting the whole run
    const BATCH = 200;
    let inserted = 0;
    for (let i = 0; i < assetInserts.length; i += BATCH) {
      const batch = assetInserts.slice(i, i + BATCH);
      try {
        await db.insert(assets).values(batch);
        inserted += batch.length;
      } catch (err) {
        console.error(`Batch ${i}-${i + batch.length} failed, retrying row-by-row:`, err instanceof Error ? err.message : err);
        for (const row of batch) {
          try {
            await db.insert(assets).values(row);
            inserted++;
          } catch (rowErr) {
            console.error(`  Skipped asset_tag=${row.assetTag}:`, rowErr instanceof Error ? rowErr.message : rowErr);
          }
        }
      }
    }
    console.log(`Inserted ${inserted}/${assetInserts.length} assets.`);
  }

  console.log(COMMIT ? "\n=== COMMIT COMPLETE ===" : "\n=== DRY RUN COMPLETE — pass --commit to write ===");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
