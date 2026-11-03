const { getCached, setCached } = require('./_cache');
const { FMP_KEY, FMP_BASE } = require('./_helpers');
const { yf: yahooFinance } = require('./_yf');
const { withApi } = require('./_api');

const SEARCHABLE = new Set(['EQUITY', 'ETF', 'CRYPTOCURRENCY']);

// Exact ticker, then tickers starting with the text, then names containing it.
function relevance(item, q) {
  const symbol = item.symbol.toLowerCase();
  const symbolScore = symbol === q ? -2 : symbol.startsWith(q) ? -1 : 0;
  return symbolScore + (item.name.toLowerCase().includes(q) ? -1 : 0);
}

async function yahooSearch(q) {
  const results = await yahooFinance.search(q, {
    newsCount: 0,
    quotesCount: 12,
    enableFuzzyQuery: true,
    enableEnhancedTrivialQuery: true,
  });
  const needle = q.toLowerCase();
  return (results.quotes || [])
    .filter((r) => SEARCHABLE.has(r.quoteType))
    .map((r) => ({ symbol: r.symbol, name: r.longname || r.shortname || r.symbol, exchange: r.exchDisp || r.exchange, type: r.quoteType }))
    .sort((a, b) => relevance(a, needle) - relevance(b, needle))
    .slice(0, 8);
}

async function fmpSearch(q) {
  const response = await fetch(`${FMP_BASE}/search-symbol?query=${encodeURIComponent(q)}&apikey=${FMP_KEY}`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`FMP search responded ${response.status}`);
  const data = await response.json();
  return (Array.isArray(data) ? data : []).slice(0, 8).map((r) => ({
    symbol: r.symbol, name: r.name || r.symbol, exchange: r.exchangeShortName || r.exchange, type: 'EQUITY',
  }));
}

async function handler(req, res) {
  const { q } = req.query;
  if (!q) return res.json([]);

  const cacheKey = `search_${q.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  let results;
  try {
    results = await yahooSearch(q);
  } catch (yahooError) {
    try {
      results = await fmpSearch(q);
    } catch {
      throw yahooError; // both failed: report Yahoo's, the primary source
    }
  }
  setCached(cacheKey, results, 3600);
  return res.json(results);
}

module.exports = withApi(handler, { name: 'search', cache: () => ({ sMaxAge: 3600, swr: 86400 }) });
