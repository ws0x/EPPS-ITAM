// One-off + reusable (for the eventual data-migration script) parser that
// extracts the `categories` table's INSERT tuples straight out of the
// Snipe-IT mysqldump, so taxonomy decisions are based on the real data
// instead of manual transcription.
import { readFileSync } from "node:fs";

const sqlPath = process.argv[2];
if (!sqlPath) {
  console.error("Usage: node parse-legacy-categories.mjs <path-to-dump.sql>");
  process.exit(1);
}

const sql = readFileSync(sqlPath, "utf8");
const marker = "INSERT INTO `categories` VALUES ";
const start = sql.indexOf(marker);
if (start === -1) throw new Error("categories INSERT not found");
const afterMarker = start + marker.length;
// Dump uses CRLF line endings, so search for the bare statement-terminating
// semicolon rather than ";\n" (no category name contains one).
const end = sql.indexOf(";", afterMarker);
const body = sql.slice(afterMarker, end);

// Parse "(...),(...),(...)" respecting quoted strings with '' escaping.
function parseTuples(str) {
  const tuples = [];
  let i = 0;
  const n = str.length;
  while (i < n) {
    while (i < n && str[i] !== "(") i++;
    if (i >= n) break;
    i++; // skip (
    const fields = [];
    let field = "";
    let inStr = false;
    while (i < n) {
      const c = str[i];
      if (inStr) {
        if (c === "'" && str[i + 1] === "'") {
          field += "'";
          i += 2;
          continue;
        }
        if (c === "'") {
          inStr = false;
          i++;
          continue;
        }
        field += c;
        i++;
        continue;
      } else {
        if (c === "'") {
          inStr = true;
          i++;
          continue;
        }
        if (c === ",") {
          fields.push(field);
          field = "";
          i++;
          continue;
        }
        if (c === ")") {
          fields.push(field);
          i++;
          break;
        }
        field += c;
        i++;
      }
    }
    tuples.push(fields.map((f) => (f === "NULL" ? null : f)));
  }
  return tuples;
}

const tuples = parseTuples(body);

const categories = tuples.map((t) => ({
  id: Number(t[0]),
  name: t[1],
  createdAt: t[2],
  updatedAt: t[3],
  createdBy: t[4],
  deletedAt: t[5],
  eulaText: t[6],
  useDefaultEula: t[7] === "1",
  requireAcceptance: t[8] === "1",
  categoryType: t[9],
  checkinEmail: t[10] === "1",
  image: t[11],
}));

console.log(`Total rows parsed: ${categories.length}`);
const active = categories.filter((c) => c.deletedAt === null);
console.log(`Active (not soft-deleted): ${active.length}`);

const byType = {};
for (const c of active) {
  byType[c.categoryType] ??= [];
  byType[c.categoryType].push(c.name);
}
for (const [type, names] of Object.entries(byType)) {
  console.log(`\n=== ${type} (${names.length}) ===`);
  names.sort((a, b) => a.localeCompare(b)).forEach((n) => console.log(" -", n));
}

// Flag exact-name duplicates that are BOTH still active (real ambiguity,
// not just historical churn already filtered out above).
const nameCounts = {};
for (const c of active) {
  const key = c.name.trim().toLowerCase();
  nameCounts[key] ??= [];
  nameCounts[key].push(c);
}
const dupes = Object.values(nameCounts).filter((arr) => arr.length > 1);
if (dupes.length) {
  console.log(`\n=== Still-active duplicate names (${dupes.length}) ===`);
  for (const arr of dupes) {
    console.log(` - "${arr[0].name}": ${arr.map((c) => `id=${c.id} type=${c.categoryType}`).join(", ")}`);
  }
}
