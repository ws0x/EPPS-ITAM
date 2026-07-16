/**
 * Straight-line depreciation, computed on read rather than written back to
 * assets.currentValue - avoids needing a cron/job to keep a stored value
 * from going stale, at the cost of a small computation per report row
 * (cheap, and correct at any point in time).
 */
export function currentBookValue(
  purchaseCost: number,
  purchaseDate: Date,
  schedule: { months: number; minimumValuePct: number }
): number {
  const floor = purchaseCost * (schedule.minimumValuePct / 100);
  if (schedule.months <= 0) return floor;

  const monthsElapsed =
    (Date.now() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 30.4375);
  if (monthsElapsed <= 0) return purchaseCost;
  if (monthsElapsed >= schedule.months) return floor;

  const depreciable = purchaseCost - floor;
  const value = purchaseCost - depreciable * (monthsElapsed / schedule.months);
  return Math.max(value, floor);
}
