/**
 * Seeds po_beneficiary_companies / po_beneficiary_departments verbatim from
 * the real PO template's "Ranges" sheet, and sets companies.managingDirectorUserId
 * to the confirmed canonical Zeinab Ali record. One-off, safe to re-run
 * (onConflictDoNothing on the unique (companyId, name) constraint).
 *
 * Run: node --env-file=.env.local --import tsx src/db/seed/seed-po-lookups.ts
 */
import { eq } from "drizzle-orm";
import { db } from "../client";
import { companies, users } from "../schema/core";
import { poBeneficiaryCompanies, poBeneficiaryDepartments } from "../schema/purchase-orders";

const MANAGING_DIRECTOR_USER_ID = "4a6d566f-d779-4e84-acc9-fd49d4d5d667";

const BENEFICIARY_COMPANIES = [
  "EPPS",
  "Fibco Global",
  "Factory - MIG",
  "Factory - Conveyors Components",
  "Factory - Conveyors",
  "3A",
];

const BENEFICIARY_DEPARTMENTS = [
  "Accounts Receivables",
  "Agricultural Agencies",
  "Agricultural Products",
  "Automation",
  "Business Development",
  "CEO",
  "Factory Equipment",
  "General Accounting",
  "HR & Personnel",
  "IT",
  "Legal Affairs",
  "Local Purchasing",
  "Machinery Sales",
  "Maintenance",
  "Marketing",
  "MIG Commercial",
  "Plastic Agencies",
  "Material Sales",
  "Reception",
  "Sales Coordination",
  "Supply Chain",
  "Support Services",
  "Warehouses",
];

async function main() {
  const allCompanies = await db.select().from(companies);
  if (allCompanies.length === 0) throw new Error("No companies found in database");

  for (const company of allCompanies) {
    await db
      .insert(poBeneficiaryCompanies)
      .values(BENEFICIARY_COMPANIES.map((name) => ({ companyId: company.id, name })))
      .onConflictDoNothing();

    await db
      .insert(poBeneficiaryDepartments)
      .values(BENEFICIARY_DEPARTMENTS.map((name) => ({ companyId: company.id, name })))
      .onConflictDoNothing();

    console.log(`Seeded PO beneficiary lookups for company ${company.name} (${company.id})`);
  }

  const [existingMd] = await db.select().from(users).where(eq(users.id, MANAGING_DIRECTOR_USER_ID)).limit(1);
  if (!existingMd) throw new Error(`No users row with id ${MANAGING_DIRECTOR_USER_ID}`);

  await db.update(companies).set({ managingDirectorUserId: MANAGING_DIRECTOR_USER_ID });
  console.log(`Set managingDirectorUserId = ${MANAGING_DIRECTOR_USER_ID} (${existingMd.email}) on all companies`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
