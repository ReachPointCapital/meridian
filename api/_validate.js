// Input validation for the serverless functions (see test/validate.test.js).
// Everything a caller can put in a query string is checked here once, before a handler runs, so no endpoint
// has to remember to do it: tickers, dates, search text and the few enumerated options.

const SYMBOL = /^[A-Za-z0-9^][A-Za-z0-9.\-=^]{0,19}$/; // AAPL, BRK-B, ^GSPC, EURUSD=X, ES=F, 000001.SS
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TYPE = /^[a-z][a-z0-9]{0,19}$/; // e.g. quote, earningshistory, m2
const TIMEFRAMES = new Set(['1D', '1W', '1M', '3M', '1Y', '5Y']);
const PERIODS = new Set(['annual', 'quarterly']);

const MAX_SYMBOLS = 100; // one Yahoo batch; the app does not cap watchlists or portfolios
const MAX_QUERY_CHARS = 60;
const MAX_URL_CHARS = 2048;
const MAX_RANGE_DAYS = 400;

const trimSpaces = (s) => s.replace(/^ +| +$/g, '');

// One ticker, upper-cased, or null.
function parseSymbol(value) {
  if (typeof value !== 'string') return null;
  const s = trimSpaces(value);
  return SYMBOL.test(s) ? s.toUpperCase() : null;
}

// "AAPL,msft,^VIX" -> ['AAPL', 'MSFT', '^VIX'] (de-duplicated, in order), or null if any is invalid or there are too many.
function parseSymbols(value, max = MAX_SYMBOLS) {
  if (typeof value !== 'string') return null;
  const out = [];
  for (const part of value.split(',')) {
    if (trimSpaces(part) === '') continue;
    const symbol = parseSymbol(part);
    if (!symbol) return null;
    if (!out.includes(symbol)) out.push(symbol);
  }
  return out.length > 0 && out.length <= max ? out : null;
}

// 'YYYY-MM-DD' that is a real calendar date, or null.
function parseDate(value) {
  if (typeof value !== 'string' || !DATE.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? value : null;
}

const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

// Validates and normalises a request's query. Unknown keys pass through untouched.
// Returns { ok: true, query } or { ok: false, status: 400, error: 'Invalid ...' }.
function normalizeQuery(query = {}) {
  const out = { ...query };
  const fail = (what) => ({ ok: false, status: 400, error: `Invalid ${what}` });

  if ('type' in out && !(typeof out.type === 'string' && TYPE.test(out.type))) return fail('type');

  if ('symbol' in out) {
    const list = out.type === 'quote' && typeof out.symbol === 'string' && out.symbol.includes(',');
    const parsed = list ? parseSymbols(out.symbol) : parseSymbol(out.symbol);
    if (!parsed) return fail('symbol');
    out.symbol = Array.isArray(parsed) ? parsed.join(',') : parsed;
  }

  if ('q' in out) {
    if (typeof out.q !== 'string') return fail('search text');
    out.q = trimSpaces(out.q.replace(/[\u0000-\u001F\u007F]/g, '').trim()).slice(0, MAX_QUERY_CHARS);
  }

  if ('timeframe' in out && !TIMEFRAMES.has(out.timeframe)) return fail('timeframe');
  if ('period' in out && !PERIODS.has(out.period)) return fail('period');

  for (const key of ['from', 'to']) {
    if (key in out && !parseDate(out[key])) return fail('date');
  }
  if (out.from && out.to) {
    const span = daysBetween(out.from, out.to);
    if (span < 0 || span > MAX_RANGE_DAYS) return fail('date range');
  }

  if ('url' in out && !(typeof out.url === 'string' && out.url.length > 0 && out.url.length <= MAX_URL_CHARS)) return fail('url');

  return { ok: true, query: out };
}

module.exports = { parseSymbol, parseSymbols, parseDate, normalizeQuery };
