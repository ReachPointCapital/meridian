const { getCached, setCached } = require('./_cache');
const { POLYGON_KEY } = require('./_helpers');
const { yahooChart } = require('./_yahoo');
const { withApi, redactUrl } = require('./_api');

function getDateRange(timeframe) {
  const now = new Date();
  const to = now.toISOString().split('T')[0];
  let from, multiplier, timespan;

  switch (timeframe) {
    case '1D':
      from = to;
      multiplier = 5;
      timespan = 'minute';
      break;
    case '1W': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      from = d.toISOString().split('T')[0];
      multiplier = 1;
      timespan = 'hour';
      break;
    }
    case '1M': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 1);
      from = d.toISOString().split('T')[0];
      multiplier = 1;
      timespan = 'day';
      break;
    }
    case '3M': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      from = d.toISOString().split('T')[0];
      multiplier = 1;
      timespan = 'day';
      break;
    }
    case '1Y': {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 1);
      from = d.toISOString().split('T')[0];
      multiplier = 1;
      timespan = 'week';
      break;
    }
    case '5Y': {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 5);
      from = d.toISOString().split('T')[0];
      multiplier = 1;
      timespan = 'week';
      break;
    }
    default:
      from = to;
      multiplier = 1;
      timespan = 'day';
  }
  return { from, to, multiplier, timespan };
}

function timeframeToYahooParams(timeframe) {
  const now = new Date();
  let period1, interval;

  switch (timeframe) {
    case '1D': {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      period1 = d.toISOString().split('T')[0];
      interval = '5m';
      break;
    }
    case '1W': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      period1 = d.toISOString().split('T')[0];
      interval = '1h';
      break;
    }
    case '1M': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 1);
      period1 = d.toISOString().split('T')[0];
      interval = '1d';
      break;
    }
    case '3M': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      period1 = d.toISOString().split('T')[0];
      interval = '1d';
      break;
    }
    case '1Y': {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 1);
      period1 = d.toISOString().split('T')[0];
      interval = '1wk';
      break;
    }
    case '5Y': {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 5);
      period1 = d.toISOString().split('T')[0];
      interval = '1wk';
      break;
    }
    default:
      period1 = now.toISOString().split('T')[0];
      interval = '1d';
  }
  return { period1, interval };
}

// How long a chart stays fresh: intraday moves in minutes, a five-year weekly chart barely moves in an hour.
const CHART_TTL = { '1D': 60, '1W': 300, '1M': 900, '3M': 900, '1Y': 3600, '5Y': 3600 };
const ttlFor = (timeframe) => CHART_TTL[timeframe] || CHART_TTL['1M'];

const NOT_FOUND = /not found|no data found|delisted/i;

async function handler(req, res) {
  const { symbol, timeframe = '1M' } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  const cacheKey = `chart_${symbol}_${timeframe}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  // Tier 1: Polygon
  try {
    const { from, to, multiplier, timespan } = getDateRange(timeframe);
    const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=asc&limit=5000&apiKey=${POLYGON_KEY}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`Polygon responded ${response.status}`);
    const data = await response.json();
    const results = data.results || [];
    if (results.length === 0) throw new Error('Polygon returned no results');
    setCached(cacheKey, results, ttlFor(timeframe));
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Source', 'polygon');
    return res.json(results);
  } catch (e) {
    console.error('Chart Tier1 (Polygon) failed:', redactUrl(e.message));
  }

  // Tier 2: Yahoo
  let yahooError;
  try {
    const { period1, interval } = timeframeToYahooParams(timeframe);
    const data = await yahooChart(symbol, period1, interval);
    if (!data || data.length === 0) throw new Error('Yahoo returned no chart data');
    setCached(cacheKey, data, ttlFor(timeframe));
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Source', 'yahoo');
    return res.json(data);
  } catch (e) {
    yahooError = e;
    console.error('Chart Tier2 (Yahoo) failed:', redactUrl(e.message));
  }

  if (NOT_FOUND.test(yahooError.message)) return res.status(404).json({ error: 'Symbol not found' });
  return res.status(500).json({ error: 'All chart sources failed' });
}

module.exports = withApi(handler, {
  name: 'chart',
  cache: (query) => {
    const ttl = ttlFor(query.timeframe || '1M');
    return { sMaxAge: ttl, swr: ttl * 2 };
  },
});
