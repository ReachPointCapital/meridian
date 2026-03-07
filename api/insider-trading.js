const { getCached, setCached } = require('./_cache');
const { FMP_KEY, FMP_BASE } = require('./_helpers');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  const cacheKey = `insider_${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  try {
    const url = `${FMP_BASE}/insider-trading?symbol=${encodeURIComponent(symbol)}&limit=10&apikey=${FMP_KEY}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Insider trading FMP HTTP error: ${response.status}`);
      throw new Error(`FMP returned ${response.status}`);
    }
    const data = await response.json();
    setCached(cacheKey, data, 21600);
    res.setHeader('X-Cache', 'MISS');
    return res.json(data);
  } catch (error) {
    console.error(`Insider trading failed for ${symbol}:`, error.message);
    res.status(500).json({ error: 'Failed to fetch insider trading data' });
  }
};
