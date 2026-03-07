const { getCached, setCached } = require('./_cache');
const { ALPHA_KEY, ALPHA_BASE } = require('./_helpers');
const { yahooScreener } = require('./_yahoo');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const cacheKey = 'av_losers';
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  // Tier 1: Yahoo screener
  try {
    const data = await yahooScreener('day_losers');
    if (!data || data.length === 0) throw new Error('Yahoo screener returned no losers');
    setCached(cacheKey, data, 900);
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Source', 'yahoo');
    return res.json(data);
  } catch (e) {
    console.error('Losers Tier1 (Yahoo) failed:', e.message);
  }

  // Tier 2: Alpha Vantage
  try {
    const url = `${ALPHA_BASE}?function=TOP_GAINERS_LOSERS&apikey=${ALPHA_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    const losers = (data.top_losers || []).slice(0, 20).map(item => ({
      symbol: item.ticker,
      name: item.ticker,
      price: parseFloat(item.price),
      change: parseFloat(item.change_amount),
      changesPercentage: parseFloat((item.change_percentage || '0').replace('%', '')),
      volume: parseInt(item.volume, 10),
    }));
    if (losers.length === 0) throw new Error('Alpha Vantage returned no losers');
    setCached(cacheKey, losers, 900);
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Source', 'alphavantage');
    return res.json(losers);
  } catch (e) {
    console.error('Losers Tier2 (AlphaVantage) failed:', e.message);
  }

  res.status(500).json({ error: 'All losers sources failed' });
};
