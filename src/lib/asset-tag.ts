import "server-only";
import { sql } from "drizzle-orm";
import type { db } from "@/db/client";
import { assetTagCounters } from "@/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Atomically reserves the next per-category, per-year sequence number and
 * returns it formatted as "{codePrefix}{YY}-{3-digit seq}" (e.g. LAP26-001).
 * Must run inside the same transaction as the asset insert - pass `tx`, not
 * `db` - so a failed asset create doesn't burn a gap in the sequence. Resets
 * per year, per category (999 assets/category/year - comfortably above this
 * company's real acquisition volume). Migrated legacy assets keep their
 * original ITAM-XXXXXXX tags untouched; this only applies going forward.
 */
export async function nextAssetTag(tx: Tx, categoryId: string, codePrefix: string, year: number) {
  const rows = await tx.execute<{ last_sequence: number }>(sql`
    insert into ${assetTagCounters} (category_id, year, last_sequence)
    values (${categoryId}, ${year}, 1)
    on conflict (category_id, year)
    do update set last_sequence = ${assetTagCounters.lastSequence} + 1
    returning last_sequence
  `);
  const sequence = rows[0].last_sequence;
  const yy = String(year).slice(-2);
  return { sequence, assetTag: `${codePrefix}${yy}-${String(sequence).padStart(3, "0")}` };
}

export function currentAssetTagYear() {
  return new Date().getUTCFullYear();
}
