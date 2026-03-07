const { getCached, setCached } = require('./_cache');
const { FMP_KEY, FMP_BASE } = require('./_helpers');
const { yahooNews, yahooGeneralNews } = require('./_yahoo');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { symbol } = req.query;
  const cacheKey = symbol ? `news_${symbol}` : 'news_general';
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  // Tier 1: Yahoo
  try {
    const data = symbol ? await yahooNews(symbol) : await yahooGeneralNews();
    if (data && data.length > 0) {
      setCached(cacheKey, data, 3600);
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Source', 'yahoo');
      return res.json(data);
    }
    throw new Error('Yahoo returned empty news');
  } catch (e) {
    console.error('News Tier1 (Yahoo) failed:', e.message);
  }

  // Tier 2: FMP
  try {
    let url;
    if (symbol) {
      url = `${FMP_BASE}/news/stock?symbols=${encodeURIComponent(symbol)}&limit=20&apikey=${FMP_KEY}`;
    } else {
      url = `${FMP_BASE}/news/general?limit=15&apikey=${FMP_KEY}`;
    }
    const response = await fetch(url);
    const data = await response.json();
    const result = Array.isArray(data) ? data : [];
    setCached(cacheKey, result, 3600);
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Source', 'fmp');
    return res.json(result);
  } catch (e) {
    console.error('News Tier2 (FMP) failed:', e.message);
  }

  res.status(500).json({ error: 'All news sources failed' });
};
