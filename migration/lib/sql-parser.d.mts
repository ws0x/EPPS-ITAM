export type LegacyRow = Record<string, string | null>;

export function loadDump(path: string): string;
export function getColumnOrder(sql: string, tableName: string): string[];
export function extractTable(sql: string, tableName: string): LegacyRow[];
export function int(v: string | null): number | null;
export function bool(v: string | null): boolean;
export function dateOrNull(v: string | null): string | null;
