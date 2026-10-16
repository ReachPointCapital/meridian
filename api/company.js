const { getCached, setCached } = require('./_cache');
const { FMP_KEY, FMP_BASE } = require('./_helpers');
const { yahooFullAnalysis, yahooAnalyst, yahooProfile, yahooEarnings, getQuoteMap } = require('./_yahoo');
const { yf: yahooFinance } = require('./_yf');
const { earningsSymbols, mapFmpEarnings } = require('./_calendar');
const { withApi, redactUrl } = require('./_api');

const DAY = 86400000;
const isoDate = (d) => d.toISOString().slice(0, 10);
const warn = (label, e) => console.warn(`[company] ${label}: ${redactUrl((e && e.message) || e)}`);

// Seconds, used both in memory and as the CDN s-maxage.
const TTL = { analysis: 3600, analyst: 3600, profile: 86400, earnings: 21600, earningshistory: 3600, shorts: 3600 };

// ── per-symbol lookups: analysis, analyst, earningshistory ──
// A loader resolves to the data, or null when the symbol does not exist.
const SYMBOL_LOADERS = new Map([
  ['analysis', async (symbol) => {
    const data = await yahooFullAnalysis(symbol); // never throws: missing parts come back null
    return data.quote || data.profile ? data : null;
  }],
  ['analyst', yahooAnalyst],
  ['earningshistory', yahooEarnings],
]);

async function forSymbol(type, req, res) {
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });
  const cacheKey = `${type}_${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }
  const data = await SYMBOL_LOADERS.get(type)(symbol);
  if (data == null) return res.status(404).json({ error: 'Symbol not found' });
  setCached(cacheKey, data, TTL[type]);
  res.setHeader('X-Cache', 'MISS');
  return res.json(data);
}

// ── profile ──
async function fmpProfile(symbol) {
  const response = await fetch(`${FMP_BASE}/profile?symbol=${encodeURIComponent(symbol)}&apikey=${FMP_KEY}`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`FMP profile responded ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error('FMP returned no profile');
  return data;
}

async function profile(req, res) {
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });
  const cacheKey = `profile_${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }
  let data;
  let source = 'yahoo';
  try {
    data = await yahooProfile(symbol);
  } catch (yahooError) {
    if (/not found/i.test(yahooError.message)) throw yahooError; // an unknown ticker is unknown to FMP too
    warn('profile (Yahoo)', yahooError);
    try {
      data = await fmpProfile(symbol);
      source = 'fmp';
    } catch (fmpError) {
      warn('profile (FMP)', fmpError);
      throw yahooError;
    }
  }
  setCached(cacheKey, data, TTL.profile);
  res.setHeader('X-Cache', 'MISS');
  res.setHeader('X-Source', source);
  return res.json(data);
}

// ── earnings calendar ──
// FMP's current endpoint is /stable/earnings-calendar (the old code called /stable/earning_calendar, which 404s).
// It lists thousands of tickers, so names and market caps are looked up (batched) only for the covered US ones.
async function fmpEarnings(from, to) {
  const response = await fetch(`${FMP_BASE}/earnings-calendar?from=${from}&to=${to}&apikey=${FMP_KEY}`, { signal: AbortSignal.timeout(6000) });
  if (!response.ok) throw new Error(`FMP earnings responded ${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('FMP earnings returned an unexpected payload');

  const wanted = new Set(earningsSymbols(rows));
  const quotes = await getQuoteMap([...wanted]).catch((e) => { warn('earnings names (Yahoo)', e); return new Map(); });
  const names = new Map([...quotes].map(([symbol, q]) => [symbol, { name: q.longName || q.shortName || symbol, marketCap: q.marketCap ?? null }]));
  return mapFmpEarnings(rows.filter((r) => wanted.has(r.symbol)), names);
}

// Last resort when FMP is unavailable: the next report date for a fixed list of the largest companies.
const MAJOR_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'JPM', 'V', 'JNJ', 'WMT', 'PG', 'MA', 'HD', 'DIS', 'NFLX', 'ADBE', 'CRM', 'INTC', 'AMD'];

async function majorEarnings(from, to) {
  const settled = await Promise.allSettled(MAJOR_TICKERS.map((s) => yahooFinance.quoteSummary(s, { modules: ['calendarEvents', 'price'] })));
  const rows = [];
  settled.forEach((r, i) => {
    if (r.status !== 'fulfilled') return;
    const calendar = r.value?.calendarEvents?.earnings;
    if (!calendar?.earningsDate?.[0]) return;
    const date = isoDate(new Date(calendar.earningsDate[0]));
    if (date < from || date > to) return;
    const price = r.value.price;
    const estimate = typeof calendar.epsEstimate === 'number' ? calendar.epsEstimate : calendar.epsEstimate?.raw ?? null;
    rows.push({ symbol: MAJOR_TICKERS[i], name: price?.longName || price?.shortName || MAJOR_TICKERS[i], date, epsEstimate: estimate, time: 'unknown' });
  });
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

async function earnings(req, res) {
  const today = new Date();
  const from = req.query.from || isoDate(today);
  const to = req.query.to || isoDate(new Date(today.getTime() + 14 * DAY));
  const cacheKey = `earnings_${from}_${to}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  let rows = [];
  try {
    rows = await fmpEarnings(from, to);
  } catch (e) {
    warn('earnings (FMP)', e);
  }
  if (rows.length === 0) {
    try {
      rows = await majorEarnings(from, to);
    } catch (e) {
      warn('earnings (Yahoo majors)', e);
    }
  }
  if (rows.length === 0) {
    res.setHeader('Cache-Control', 'no-store'); // do not pin an empty answer
    return res.json([]);
  }
  setCached(cacheKey, rows, TTL.earnings);
  return res.json(rows);
}

// ── shorts ──
const shortRow = (q, stats = {}) => ({
  ticker: q.symbol,
  name: q.longName || q.shortName || q.symbol,
  price: q.regularMarketPrice,
  changePercent: q.regularMarketChangePercent,
  shortPercentOfFloat: stats.shortPercentOfFloat ?? q.shortPercentOfFloat ?? null,
  shortRatio: stats.shortRatio ?? q.shortRatio ?? null,
});

// Yahoo's predefined short-interest screener, or (if it is empty) the most active stocks enriched one by one.
async function mostShorted() {
  try {
    const { quotes = [] } = await yahooFinance.screener({ scrIds: 'most_shorted_stocks', count: 20 });
    if (quotes.length > 0) return { data: quotes.map((q) => shortRow(q)), source: 'yahoo-most_shorted_stocks' };
  } catch (e) {
    warn('shorts screener', e);
  }
  try {
    const { quotes = [] } = await yahooFinance.screener({ scrIds: 'most_actives', count: 25 });
    const enriched = await Promise.allSettled(quotes.slice(0, 20).map(async (q) => {
      const summary = await yahooFinance.quoteSummary(q.symbol, { modules: ['defaultKeyStatistics'] }).catch(() => ({}));
      const stats = summary.defaultKeyStatistics || {};
      return shortRow(q, { shortPercentOfFloat: stats.shortPercentOfFloat?.raw ?? stats.shortPercentOfFloat, shortRatio: stats.shortRatio?.raw ?? stats.shortRatio });
    }));
    const data = enriched.filter((r) => r.status === 'fulfilled' && r.value.ticker).map((r) => r.value)
      .sort((a, b) => (b.shortPercentOfFloat || 0) - (a.shortPercentOfFloat || 0));
    if (data.length > 0) return { data, source: 'yahoo-actives-enriched' };
  } catch (e) {
    warn('shorts enrichment', e);
  }
  return null;
}

async function shorts(req, res) {
  const cacheKey = 'most_shorted';
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }
  const found = await mostShorted();
  if (!found) {
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ data: [], message: 'Short interest data temporarily unavailable' });
  }
  setCached(cacheKey, found.data, TTL.shorts);
  res.setHeader('X-Cache', 'MISS');
  res.setHeader('X-Source', found.source);
  return res.json(found.data);
}

async function handler(req, res) {
  const { type } = req.query;
  if (SYMBOL_LOADERS.has(type)) return forSymbol(type, req, res);
  if (type === 'profile') return profile(req, res);
  if (type === 'earnings') return earnings(req, res);
  if (type === 'shorts') return shorts(req, res);
  return res.status(400).json({ error: 'Invalid type. Expected: analysis, analyst, profile, earnings, earningshistory, shorts' });
}

module.exports = withApi(handler, {
  name: 'company',
  cache: (query) => (Object.hasOwn(TTL, query.type) ? { sMaxAge: TTL[query.type], swr: TTL[query.type] } : null),
});
