const { getCached, setCached } = require('./_cache');
const { FMP_KEY, FMP_BASE } = require('./_helpers');
const { getQuotes, quotesInOrder, mapQuote, yahooScreener, yahooSectors } = require('./_yahoo');
const { fetchHeatmap } = require('./_heatmap');
const { fetchAlphaMovers, parseAlphaMovers } = require('./_movers');
const { withApi, redactUrl } = require('./_api');

// Seconds, used both in memory and as the CDN s-maxage. Quotes are a minute old at most during the trading day.
const TTL = { quote: 60, movers: 120, sectors: 300, heatmap: 300 };

const MOVERS = new Map([
  ['gainers', { screener: 'day_gainers', alpha: 'top_gainers' }],
  ['losers', { screener: 'day_losers', alpha: 'top_losers' }],
  ['actives', { screener: 'most_actives', alpha: 'most_actively_traded' }],
]);

const TYPES = ['quote', ...MOVERS.keys(), 'sectors', 'heatmap'];

// Serves `load()` from the in-memory cache when it can, and remembers the answer for `ttl` seconds.
// `load` resolves to { data, source }; data null means the thing asked for does not exist.
async function cachedJson(res, cacheKey, ttl, load) {
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }
  const { data, source } = await load();
  if (data == null) return res.status(404).json({ error: 'Symbol not found' });
  setCached(cacheKey, data, ttl);
  res.setHeader('X-Cache', 'MISS');
  if (source) res.setHeader('X-Source', source);
  return res.json(data);
}

// FMP's quote endpoint, used only when Yahoo is unreachable.
async function fmpQuote(symbol) {
  const response = await fetch(`${FMP_BASE}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${FMP_KEY}`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`FMP quote responded ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('FMP quote returned an unexpected payload');
  return data;
}

async function quote(req, res) {
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });
  const symbols = symbol.split(',');
  const multi = symbols.length > 1;
  const cacheKey = multi ? `quote_multi_${[...symbols].sort().join(',')}` : `quote_${symbol}`;

  return cachedJson(res, cacheKey, TTL.quote, async () => {
    let quotes;
    let source = 'yahoo';
    try {
      quotes = quotesInOrder(symbols, await getQuotes(symbols)).map(mapQuote);
    } catch (yahooError) {
      console.error('Quote (Yahoo) failed:', redactUrl(yahooError.message));
      try {
        quotes = await fmpQuote(symbol);
        source = 'fmp';
      } catch (fmpError) {
        console.error('Quote (FMP) failed:', redactUrl(fmpError.message));
        throw yahooError;
      }
    }
    if (multi) return { data: quotes, source };
    if (quotes.length === 0) return { data: null };
    return { data: source === 'fmp' ? quotes : quotes[0], source };
  });
}

async function movers(kind, res) {
  const { screener, alpha } = MOVERS.get(kind);
  return cachedJson(res, `movers_${kind}`, TTL.movers, async () => {
    let data = await yahooScreener(screener); // returns [] when Yahoo fails
    let source = 'yahoo';
    if (data.length === 0) {
      data = parseAlphaMovers(await fetchAlphaMovers(), alpha);
      source = 'alphavantage';
    }
    if (data.length === 0) throw new Error(`No ${kind} data available`);
    return { data, source };
  });
}

async function sectors(res) {
  return cachedJson(res, 'sectors', TTL.sectors, async () => {
    const raw = await yahooSectors();
    const data = Object.entries(raw).map(([sector, pct]) => ({ sector, changesPercentage: parseFloat(pct), source: 'yahoo' }));
    if (data.length === 0) throw new Error('Yahoo returned no sector data');
    return { data, source: 'yahoo' };
  });
}

async function heatmap(res) {
  return cachedJson(res, 'heatmap_data_v4', TTL.heatmap, async () => {
    const data = await fetchHeatmap();
    if (data.length === 0) throw new Error('Yahoo returned no heatmap data');
    return { data, source: 'yahoo' };
  });
}

async function handler(req, res) {
  const { type } = req.query;
  if (type === 'quote') return quote(req, res);
  if (MOVERS.has(type)) return movers(type, res);
  if (type === 'sectors') return sectors(res);
  if (type === 'heatmap') return heatmap(res);
  return res.status(400).json({ error: `Invalid type. Expected: ${TYPES.join(', ')}` });
}

function cachePolicy(query) {
  const ttl = query.type === 'quote' ? TTL.quote
    : MOVERS.has(query.type) ? TTL.movers
    : query.type === 'sectors' ? TTL.sectors
    : query.type === 'heatmap' ? TTL.heatmap
    : null;
  return ttl ? { sMaxAge: ttl, swr: ttl * 5 } : null;
}

module.exports = withApi(handler, { name: 'market', cache: cachePolicy });
