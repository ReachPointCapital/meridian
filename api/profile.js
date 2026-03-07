const { getCached, setCached } = require('./_cache');
const { FMP_KEY, FMP_BASE } = require('./_helpers');
const { yahooProfile } = require('./_yahoo');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  const cacheKey = `profile_${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  // Tier 1: Yahoo
  try {
    const data = await yahooProfile(symbol);
    setCached(cacheKey, data, 86400);
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Source', 'yahoo');
    return res.json(data);
  } catch (e) {
    console.error('Profile Tier1 (Yahoo) failed:', e.message);
  }

  // Tier 2: FMP
  try {
    const response = await fetch(`${FMP_BASE}/profile?symbol=${encodeURIComponent(symbol)}&apikey=${FMP_KEY}`);
    const data = await response.json();
    setCached(cacheKey, data, 86400);
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Source', 'fmp');
    return res.json(data);
  } catch (e) {
    console.error('Profile Tier2 (FMP) failed:', e.message);
  }

  res.status(500).json({ error: 'All profile sources failed' });
};
