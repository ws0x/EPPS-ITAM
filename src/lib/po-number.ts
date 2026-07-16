import "server-only";
import { sql } from "drizzle-orm";
import type { db } from "@/db/client";
import { poCounters } from "@/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Atomically reserves the next sequence number for a company/year and
 * returns it formatted as "IT {n}-{year}" (matches the existing manual
 * convention). Must run inside the same transaction as the PO insert -
 * pass `tx`, not `db` - so a failed PO create doesn't burn a gap in the
 * sequence.
 */
export async function nextPoNumber(tx: Tx, companyId: string, year: number) {
  const rows = await tx.execute<{ last_sequence: number }>(sql`
    insert into ${poCounters} (company_id, year, last_sequence)
    values (${companyId}, ${year}, 1)
    on conflict (company_id, year)
    do update set last_sequence = ${poCounters.lastSequence} + 1
    returning last_sequence
  `);
  const sequence = rows[0].last_sequence;
  return { sequence, poNumber: `IT ${sequence}-${year}` };
}

export function currentPoYear() {
  return new Date().getUTCFullYear();
}
