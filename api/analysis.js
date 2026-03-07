const { getCached, setCached } = require('./_cache');
const { yahooFullAnalysis } = require('./_yahoo');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  const cacheKey = `analysis_${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  try {
    const data = await yahooFullAnalysis(symbol);
    setCached(cacheKey, data, 3600);
    res.setHeader('X-Cache', 'MISS');
    return res.json(data);
  } catch (error) {
    console.error(`Analysis failed for ${symbol}:`, error.message);
    res.status(500).json({ error: 'Failed to fetch analysis data' });
  }
};
