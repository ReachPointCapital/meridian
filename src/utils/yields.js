// The sidebar's "2Y Yield" row. It is not a Yahoo symbol: Yahoo's 2-year symbol is a futures contract that freezes when it
// expires, so the 2Y comes from the yields feed (api/dashboard.js, FRED's daily DGS2), the same source as the yield curve.
export const TWO_YEAR_SYMBOL = 'DGS2';

// The 2Y row of the yields feed as a sidebar quote, or null when the feed has no usable 2Y (the row then shows a dash).
export function twoYearQuote(yields) {
  const row = Array.isArray(yields) ? yields.find((y) => y.maturity === '2Y') : null;
  if (!row || row.yield == null || !Number.isFinite(Number(row.yield))) return null;
  // asOf: FRED publishes a day behind the other tenors, so the sidebar shows this date when the row is hovered.
  return { symbol: TWO_YEAR_SYMBOL, price: Number(row.yield), changePercent: row.change ?? null, asOf: row.asOf ?? null };
}
