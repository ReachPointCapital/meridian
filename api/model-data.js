const { getCached, setCached } = require('./_cache');
const { FMP_KEY } = require('./_helpers');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  const cacheKey = `model_data_${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  const base = 'https://financialmodelingprep.com/api/v3';

  const urls = {
    incomeStatement: `${base}/income-statement/${encodeURIComponent(symbol)}?limit=5&apikey=${FMP_KEY}`,
    cashFlow: `${base}/cash-flow-statement/${encodeURIComponent(symbol)}?limit=5&apikey=${FMP_KEY}`,
    balanceSheet: `${base}/balance-sheet-statement/${encodeURIComponent(symbol)}?limit=5&apikey=${FMP_KEY}`,
    keyMetrics: `${base}/key-metrics/${encodeURIComponent(symbol)}?limit=5&apikey=${FMP_KEY}`,
    profile: `${base}/profile/${encodeURIComponent(symbol)}?apikey=${FMP_KEY}`,
    peers: `https://financialmodelingprep.com/api/v4/stock_peers?symbol=${encodeURIComponent(symbol)}&apikey=${FMP_KEY}`,
    quote: `${base}/quote/${encodeURIComponent(symbol)}?apikey=${FMP_KEY}`,
  };

  const results = await Promise.allSettled(
    Object.entries(urls).map(async ([key, url]) => {
      const response = await fetch(url);
      const data = await response.json();
      return [key, data];
    })
  );

  const output = {};
  results.forEach(r => {
    if (r.status === 'fulfilled') {
      const [key, data] = r.value;
      output[key] = data;
    }
  });

  setCached(cacheKey, output, 3600);
  res.setHeader('X-Cache', 'MISS');
  return res.json(output);
};
