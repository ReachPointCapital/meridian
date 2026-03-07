const { getCached, setCached } = require('./_cache');
const { POLYGON_KEY } = require('./_helpers');
const { yahooChart } = require('./_yahoo');

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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

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
    const response = await fetch(url);
    const data = await response.json();
    const results = data.results || [];
    if (results.length === 0) throw new Error('Polygon returned no results');
    setCached(cacheKey, results, 900);
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Source', 'polygon');
    return res.json(results);
  } catch (e) {
    console.error('Chart Tier1 (Polygon) failed:', e.message);
  }

  // Tier 2: Yahoo
  try {
    const { period1, interval } = timeframeToYahooParams(timeframe);
    const data = await yahooChart(symbol, period1, interval);
    if (!data || data.length === 0) throw new Error('Yahoo returned no chart data');
    setCached(cacheKey, data, 900);
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Source', 'yahoo');
    return res.json(data);
  } catch (e) {
    console.error('Chart Tier2 (Yahoo) failed:', e.message);
  }

  res.status(500).json({ error: 'All chart sources failed' });
};
