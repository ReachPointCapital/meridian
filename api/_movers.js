// Alpha Vantage top movers: the fallback when Yahoo's screeners fail (see test/movers.test.js).
// One request feeds gainers, losers and most-active (the old code made three identical calls against a free tier
// that allows 25 a day), and the junk AV's list is full of is dropped: sub-dollar stocks, warrants, rights and units.
const { getCached, setCached } = require('./_cache');
const { ALPHA_KEY, ALPHA_BASE } = require('./_helpers');

const MAX_ROWS = 20;
const COMMON_STOCK = /^[A-Z]{1,5}(-[A-Z])?$/;
const WARRANT_RIGHT_UNIT = /^[A-Z]{4}[WRU]$/; // five letters ending in W, R or U

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

function parseAlphaMovers(data, key) {
  const list = data && Array.isArray(data[key]) ? data[key] : [];
  const out = [];
  for (const item of list) {
    if (!item || typeof item.ticker !== 'string') continue;
    if (!COMMON_STOCK.test(item.ticker) || WARRANT_RIGHT_UNIT.test(item.ticker)) continue;
    const price = num(item.price);
    if (price == null || price < 1) continue;
    out.push({
      symbol: item.ticker,
      name: item.ticker,
      price,
      change: num(item.change_amount),
      changesPercentage: num(String(item.change_percentage ?? '').replace('%', '')),
      volume: num(item.volume),
    });
    if (out.length === MAX_ROWS) break;
  }
  return out;
}

const CACHE_KEY = 'av_movers';

async function fetchAlphaMovers({ fetchImpl = (...args) => fetch(...args) } = {}) {
  const cached = getCached(CACHE_KEY);
  if (cached) return cached;
  if (!ALPHA_KEY) throw new Error('Alpha Vantage is not configured');
  const res = await fetchImpl(`${ALPHA_BASE}?function=TOP_GAINERS_LOSERS&apikey=${ALPHA_KEY}`, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`Alpha Vantage responded ${res.status}`);
  const data = await res.json();
  // A rate-limit notice is a 200 with no lists: do not keep it.
  if (data && Array.isArray(data.top_gainers)) setCached(CACHE_KEY, data, 900);
  return data;
}

module.exports = { parseAlphaMovers, fetchAlphaMovers };
