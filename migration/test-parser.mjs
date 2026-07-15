import { loadDump, extractTable, getColumnOrder } from "./lib/sql-parser.mjs";

const sql = loadDump("./migration/snipeit-backup.sql");

for (const table of ["locations", "departments", "users", "categories", "status_labels", "manufacturers", "assets"]) {
  const cols = getColumnOrder(sql, table);
  const rows = extractTable(sql, table);
  console.log(`${table}: ${cols.length} columns, ${rows.length} rows`);
}

console.log("\nSample location row:", JSON.stringify(extractTable(sql, "locations")[0], null, 2));
console.log("\nSample user row (first 8 keys):");
const u = extractTable(sql, "users")[0];
console.log(Object.fromEntries(Object.entries(u).slice(0, 8)));
