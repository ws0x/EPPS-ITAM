import { db } from "../client";
import { companies, roles } from "../schema/core";
import { categories, statusLabels } from "../schema/catalog";
import { seedCategories, seedStatusLabels, seedRoles } from "./data";

async function main() {
  console.log("Seeding: company...");
  const [company] = await db
    .insert(companies)
    .values({ name: "Makka Corp - EPPS HQ" })
    .returning();

  console.log("Seeding: roles...");
  await db.insert(roles).values(seedRoles);

  console.log("Seeding: status labels...");
  await db.insert(statusLabels).values(
    seedStatusLabels.map((s) => ({ ...s, companyId: company.id })),
  );

  console.log("Seeding: categories...");
  await db.insert(categories).values(
    seedCategories.map((c) => ({ ...c, companyId: company.id })),
  );

  console.log(`Done. Company id: ${company.id}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
