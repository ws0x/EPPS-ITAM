import { eq } from "drizzle-orm";
import { db } from "../client";
import { companies } from "../schema/core";

/** Real values extracted directly from the client's Excel template (H2) - see BACKLOG.md. */
async function main() {
  const [company] = await db.select().from(companies).limit(1);
  if (!company) throw new Error("No company found");

  await db
    .update(companies)
    .set({
      letterheadLogoUrl: "/brand/EPPS-logo-mark.png",
      letterheadNameLine1: "Egyptian Packaging & Plastic Systems",
      letterheadNameLine2: "EPPS Al-Mokarama",
      letterheadTagline: "Your First Choice in the Packaging World",
      letterheadOfficePhone: "+2(02) 274 150 13 / 14  |  +2 (02) 274 150 22 / 23",
      letterheadMobilePhone: "+2 (012) 239 007 81",
      letterheadFax: "+2 (02) 274 150 15",
      letterheadEmails: "sales@eppscorp.com  |  sales@EPPS-eg.com",
      letterheadWebsite: "www.eppscorp.com",
      letterheadAddress: "2 Ahmed Mostafa St. Off Salah Salem, beside Garden P.O.Box 47 Manial, Cairo 11555, Egypt",
    })
    .where(eq(companies.id, company.id));

  console.log(`Seeded letterhead fields for ${company.name}`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
