import { describe, it, expect } from "vitest";
import { currentBookValue } from "./depreciation";

const MONTH_MS = 1000 * 60 * 60 * 24 * 30.4375;

describe("currentBookValue", () => {
  it("returns full purchase cost the moment it's bought", () => {
    const value = currentBookValue(1200, new Date(), { months: 36, minimumValuePct: 10 });
    expect(value).toBeCloseTo(1200, 0);
  });

  it("floors at minimumValuePct once the useful life has fully elapsed", () => {
    const purchaseDate = new Date(Date.now() - 40 * MONTH_MS); // past the 36-month life
    const value = currentBookValue(1200, purchaseDate, { months: 36, minimumValuePct: 10 });
    expect(value).toBe(120); // 10% of 1200
  });

  it("depreciates linearly at the halfway point of the useful life", () => {
    const purchaseDate = new Date(Date.now() - 18 * MONTH_MS); // half of 36 months
    const value = currentBookValue(1200, purchaseDate, { months: 36, minimumValuePct: 10 });
    // depreciable = 1200 - 120 = 1080; halfway through -> half depreciated
    expect(value).toBeCloseTo(1200 - 1080 * 0.5, 0);
  });

  it("never depreciates below the floor even with a future purchase date typo", () => {
    const purchaseDate = new Date(Date.now() + MONTH_MS); // in the future
    const value = currentBookValue(1000, purchaseDate, { months: 12, minimumValuePct: 20 });
    expect(value).toBe(1000);
  });

  it("treats a zero-month schedule as immediately at the floor", () => {
    const value = currentBookValue(1000, new Date(), { months: 0, minimumValuePct: 25 });
    expect(value).toBe(250);
  });

  it("never returns a value below the floor for any elapsed time", () => {
    const purchaseDate = new Date(Date.now() - 100 * MONTH_MS);
    const value = currentBookValue(500, purchaseDate, { months: 24, minimumValuePct: 15 });
    expect(value).toBeGreaterThanOrEqual(500 * 0.15 - 0.0001);
  });
});
