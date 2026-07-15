import { loadDump, extractTable } from "./lib/sql-parser.mjs";

const sql = loadDump("./migration/snipeit-backup.sql");
const categories = extractTable(sql, "categories");
const assets = extractTable(sql, "assets");

// Full id->row map (active + soft-deleted) so we can resolve every asset's
// legacy category regardless of later reorganizations.
const catById = new Map(categories.map((c) => [c.id, c]));
const activeByName = new Map(
  categories.filter((c) => c.deleted_at === null).map((c) => [c.name.trim().toLowerCase(), c]),
);

// models table maps assets -> category, not assets directly
const models = extractTable(sql, "models");
const modelById = new Map(models.map((m) => [m.id, m]));

const unmatched = new Map(); // categoryType -> count
let matched = 0;
let noModel = 0;

const includeDeleted = process.argv.includes("--include-deleted");

for (const asset of assets) {
  if (asset.deleted_at && !includeDeleted) continue;
  const model = modelById.get(asset.model_id);
  if (!model) {
    noModel++;
    continue;
  }
  const cat = catById.get(model.category_id);
  if (!cat) {
    unmatched.set("(no category row)", (unmatched.get("(no category row)") ?? 0) + 1);
    continue;
  }
  const activeMatch = activeByName.get(cat.name.trim().toLowerCase());
  if (activeMatch) {
    matched++;
  } else {
    const key = `${cat.category_type}: ${cat.name}`;
    unmatched.set(key, (unmatched.get(key) ?? 0) + 1);
  }
}

console.log(`Active (non-deleted) assets: ${assets.filter((a) => !a.deleted_at).length}`);
console.log(`Matched to an active category by name: ${matched}`);
console.log(`Assets with no model row: ${noModel}`);
console.log(`Unmatched, by legacy category (type: name) -> count:`);
[...unmatched.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${v}\t${k}`));
