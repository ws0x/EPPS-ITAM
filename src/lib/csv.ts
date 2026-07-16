/**
 * Escapes a single CSV cell: doubles embedded quotes and always wraps in
 * quotes, plus a leading apostrophe if the value starts with = + - @ (the
 * standard OWASP mitigation for CSV/Excel formula injection - a cell like
 * `=cmd|'/c calc'!A1` would otherwise execute as a formula when the file is
 * opened in Excel/Sheets). Free-text fields in this app (asset name, serial,
 * user names, etc.) are user-entered, so this must not be skipped.
 */
export function toCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  let s = String(value);
  if (/^[=+\-@]/.test(s)) {
    s = `'${s}`;
  }
  return `"${s.replace(/"/g, '""')}"`;
}

export function buildCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(toCsvCell).join(",")];
  for (const row of rows) {
    lines.push(row.map(toCsvCell).join(","));
  }
  return lines.join("\n");
}

export function csvResponseHeaders(filenamePrefix: string) {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filenamePrefix}_${new Date().toISOString().split("T")[0]}.csv"`,
  };
}
