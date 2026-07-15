// Generic mysqldump parser: extracts column order from CREATE TABLE and
// tuples from INSERT INTO ... VALUES (...), zipping them into row objects
// keyed by column name (avoids positional-index bugs across ~15 tables).
//
// Builds on scripts/parse-legacy-categories.mjs's proven approach:
// - search for the bare `;` as statement terminator, not `;\n` — this dump
//   uses CRLF line endings, so `;\n` never matches and the naive approach
//   silently engulfs unrelated subsequent statements.
// - respect '' as an escaped quote inside a quoted string.

import { readFileSync } from "node:fs";

let _sqlCache = null;
export function loadDump(path) {
  if (!_sqlCache) _sqlCache = readFileSync(path, "utf8");
  return _sqlCache;
}

export function getColumnOrder(sql, tableName) {
  const marker = `CREATE TABLE \`${tableName}\` (`;
  const start = sql.indexOf(marker);
  if (start === -1) throw new Error(`CREATE TABLE for '${tableName}' not found`);
  const afterMarker = start + marker.length;
  const end = sql.indexOf("\n) ENGINE=", afterMarker);
  const body = sql.slice(afterMarker, end);

  const columns = [];
  for (const line of body.split("\n")) {
    const m = line.match(/^\s*`([a-zA-Z0-9_]+)`/);
    if (m) columns.push(m[1]);
  }
  return columns;
}

function parseTuples(str) {
  const tuples = [];
  let i = 0;
  const n = str.length;
  while (i < n) {
    while (i < n && str[i] !== "(") i++;
    if (i >= n) break;
    i++;
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
        if (c === "\\" && str[i + 1] !== undefined) {
          // mysqldump backslash-escapes within strings (\', \\, \n, ...)
          field += str[i + 1];
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

/**
 * Returns an array of row objects for `tableName`, keyed by real column
 * names (from the CREATE TABLE statement), values as raw strings/null.
 * Caller is responsible for type coercion (int, date, bool-as-'0'/'1').
 */
export function extractTable(sql, tableName) {
  const columns = getColumnOrder(sql, tableName);
  const marker = `INSERT INTO \`${tableName}\` VALUES `;
  const rows = [];

  let searchFrom = 0;
  while (true) {
    const start = sql.indexOf(marker, searchFrom);
    if (start === -1) break;
    const afterMarker = start + marker.length;
    const end = sql.indexOf(";", afterMarker);
    const body = sql.slice(afterMarker, end);
    const tuples = parseTuples(body);
    for (const tuple of tuples) {
      const row = {};
      columns.forEach((col, idx) => (row[col] = tuple[idx] ?? null));
      rows.push(row);
    }
    searchFrom = end + 1;
  }
  return rows;
}

export const int = (v) => (v === null ? null : Number.parseInt(v, 10));
export const bool = (v) => v === "1";
export const dateOrNull = (v) => (!v || v === "0000-00-00" || v === "0000-00-00 00:00:00" ? null : v);
