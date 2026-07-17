import { describe, it, expect } from "vitest";
import { toCsvCell, buildCsv } from "./csv";

describe("toCsvCell", () => {
  it("returns an empty string for null, undefined, or empty input", () => {
    expect(toCsvCell(null)).toBe("");
    expect(toCsvCell(undefined)).toBe("");
    expect(toCsvCell("")).toBe("");
  });

  it("wraps plain values in quotes", () => {
    expect(toCsvCell("Laptop")).toBe('"Laptop"');
    expect(toCsvCell(42)).toBe('"42"');
  });

  it("doubles embedded quotes", () => {
    expect(toCsvCell('Say "hi"')).toBe('"Say ""hi"""');
  });

  it("prefixes a leading apostrophe for values starting with = + - @ (CSV/formula injection)", () => {
    expect(toCsvCell("=cmd|'/c calc'!A1")).toBe(`"'=cmd|'/c calc'!A1"`);
    expect(toCsvCell("+1234")).toBe(`"'+1234"`);
    expect(toCsvCell("-1234")).toBe(`"'-1234"`);
    expect(toCsvCell("@SUM(A1)")).toBe(`"'@SUM(A1)"`);
  });

  it("does not mangle values that merely contain those characters mid-string", () => {
    expect(toCsvCell("Total = 5")).toBe('"Total = 5"');
  });
});

describe("buildCsv", () => {
  it("joins headers and rows with commas and newlines", () => {
    const csv = buildCsv(["Name", "Qty"], [["Widget", 3], ["Gadget", 5]]);
    expect(csv).toBe('"Name","Qty"\n"Widget","3"\n"Gadget","5"');
  });

  it("hardens every row against formula injection, not just the first", () => {
    const csv = buildCsv(["Name"], [["=1+1"], ["Safe"]]);
    expect(csv).toContain(`"'=1+1"`);
    expect(csv).toContain('"Safe"');
  });
});
