// Calendar data helpers (see test/calendar.test.js): estimated US economic events, earnings rows from FMP's
// current /stable/earnings-calendar, and IPO rows from SEC EDGAR filings.
// All date arithmetic is UTC, so results do not depend on the server's timezone (the old code mixed local-time
// getDay() with UTC ISO strings and put "Thursday" jobless claims on Fridays on any non-UTC machine).

const { FOMC_2026 } = require('./_macro');

const iso = (d) => d.toISOString().slice(0, 10);
const utc = (y, m, d) => new Date(Date.UTC(y, m, d));

// Rules of thumb, not a schedule: every event produced here is labelled "(est.)" and flagged estimated: true.
const RECURRING = [
  { event: 'Nonfarm Payrolls', impact: 'High', rule: 'first-friday' },
  { event: 'Initial Jobless Claims', impact: 'Medium', rule: 'thursday' },
  { event: 'ISM Manufacturing PMI', impact: 'Medium', day: 1 },
  { event: 'CPI Release', impact: 'High', day: 12 },
  { event: 'PPI Release', impact: 'Medium', day: 14 },
  { event: 'Retail Sales', impact: 'Medium', day: 16 },
  { event: 'Housing Starts', impact: 'Low', day: 18 },
  { event: 'Consumer Confidence', impact: 'Medium', day: 25 },
  { event: 'GDP Estimate', impact: 'High', day: 28 },
  { event: 'PCE Price Index', impact: 'High', day: 30 },
];

function makeEvent(rule, date) {
  return {
    event: `${rule.event} (est.)`, date, country: 'US', impact: rule.impact,
    estimate: null, previous: null, actual: null, estimated: true,
  };
}

function recurringEstimates(from, to) {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  const events = [];

  for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86400000)) {
    const dow = d.getUTCDay();
    for (const rule of RECURRING) {
      if (rule.rule === 'thursday' && dow === 4) events.push(makeEvent(rule, iso(d)));
      if (rule.rule === 'first-friday' && dow === 5 && d.getUTCDate() <= 7) events.push(makeEvent(rule, iso(d)));
    }
  }

  // Fixed-day events: look one month back too, because a weekend date moves forward into the next month.
  for (let y = start.getUTCFullYear(), m = start.getUTCMonth() - 1; utc(y, m, 1) <= end; m++) {
    for (const rule of RECURRING.filter((r) => r.day)) {
      const lastDay = utc(y, m + 1, 0).getUTCDate();
      let when = utc(y, m, Math.min(rule.day, lastDay));
      if (when.getUTCDay() === 6) when = new Date(when.getTime() + 2 * 86400000);
      if (when.getUTCDay() === 0) when = new Date(when.getTime() + 86400000);
      if (when >= start && when <= end) events.push(makeEvent(rule, iso(when)));
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date) || a.event.localeCompare(b.event));
}

// Official FOMC decision days (the one scheduled event here that is not an estimate).
function fomcEvents(from, to) {
  return FOMC_2026.filter((date) => date >= from && date <= to).map((date) => ({
    event: 'FOMC Rate Decision', date, country: 'US', impact: 'High',
    estimate: null, previous: null, actual: null, estimated: false,
  }));
}

// FMP /stable/earnings-calendar rows -> the shape the Earnings pages read. `names` maps symbol -> { name, marketCap }.
const MAX_EARNINGS_ROWS = 400;
const US_TICKER = /^[A-Z0-9]{1,6}(-[A-Z])?$/;

// The calendar lists thousands of tickers, foreign listings and uncovered micro-caps among them. Names and market caps
// are only worth fetching for US tickers that analysts cover, and the ones expecting the most revenue go first.
function earningsSymbols(rows, max = 500) {
  if (!Array.isArray(rows)) return [];
  const best = new Map();
  for (const r of rows) {
    if (!r || !US_TICKER.test(r.symbol || '')) continue;
    if (r.epsEstimated == null && r.revenueEstimated == null) continue;
    best.set(r.symbol, Math.max(best.get(r.symbol) ?? 0, r.revenueEstimated ?? 0));
  }
  return [...best.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([symbol]) => symbol);
}

function mapFmpEarnings(rows, names = new Map()) {
  if (!Array.isArray(rows)) return [];
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    if (!r || !r.symbol || !r.date) continue;
    const key = `${r.symbol}|${r.date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const info = names.get(r.symbol) || {};
    out.push({
      symbol: r.symbol,
      name: info.name || r.symbol,
      date: r.date,
      epsEstimate: r.epsEstimated ?? null,
      epsActual: r.epsActual ?? null,
      revenueEstimate: r.revenueEstimated ?? null,
      revenueActual: r.revenueActual ?? null,
      fiscalDateEnding: r.fiscalDateEnding ?? null,
      time: 'unknown',
      marketCap: info.marketCap ?? null,
    });
  }
  // Keep the most relevant names across the whole window, then show them in date order.
  const byCap = (a, b) => (b.marketCap || 0) - (a.marketCap || 0) || a.symbol.localeCompare(b.symbol);
  return out.sort(byCap).slice(0, MAX_EARNINGS_ROWS)
    .sort((a, b) => a.date.localeCompare(b.date) || byCap(a, b));
}

// SEC EDGAR display names look like "iPower Inc.  (IPW)  (CIK 0001830072)".
function parseEdgarName(display) {
  if (!display || typeof display !== 'string') return { company: 'Unknown', symbol: '' };
  let text = display.replace(/\(CIK\s*\d+\)/i, '').trim();
  let symbol = '';
  const m = text.match(/\(([A-Z0-9.-]+(?:\s*,\s*[A-Z0-9.-]+)*)\)\s*$/);
  if (m) {
    symbol = m[1].split(',')[0].trim();
    text = text.slice(0, m.index);
  }
  return { company: text.replace(/\s+/g, ' ').trim(), symbol };
}

// Priced offerings (424B4) win over a later look at the same company's S-1; newest first.
function buildIpoRows({ prospectus = [], s1 = [] }) {
  const rows = [];
  const seen = new Set();
  const add = (hits, status) => {
    for (const hit of hits) {
      const src = (hit && hit._source) || {};
      const { company, symbol } = parseEdgarName((src.display_names && src.display_names[0]) || src.entity_name);
      const key = (symbol || company).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ company, symbol, exchange: '', date: src.file_date || '', priceRange: status });
    }
  };
  add(prospectus.slice(0, 8), 'Priced');
  add(s1.slice(0, 10), 'Filed (S-1)');
  return rows.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);
}

module.exports = { recurringEstimates, fomcEvents, earningsSymbols, mapFmpEarnings, parseEdgarName, buildIpoRows };
