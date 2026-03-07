const { getCached, setCached } = require('./_cache');
const { FMP_KEY, FMP_BASE } = require('./_helpers');
const { yahooMacro } = require('./_yahoo');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const cacheKey = 'macro_all';
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  // Tier 1: Yahoo
  try {
    const data = await yahooMacro();
    if (!data || data.length === 0) throw new Error('Yahoo returned empty macro data');
    setCached(cacheKey, data, 900);
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Source', 'yahoo');
    return res.json(data);
  } catch (e) {
    console.error('Macro Tier1 (Yahoo) failed:', e.message);
  }

  // Tier 2: FMP
  try {
    const symbols = 'SPY,QQQ,DIA,IWM,VXX,GLD,USO';
    const response = await fetch(`${FMP_BASE}/quote?symbol=${symbols}&apikey=${FMP_KEY}`);
    const quotes = await response.json();
    if (!Array.isArray(quotes) || quotes.length === 0) throw new Error('FMP returned empty quotes');
    const data = quotes.map(q => ({
      symbol: q.symbol,
      label: q.name || q.symbol,
      price: q.price,
      change: q.change,
      changePercent: q.changesPercentage,
    }));
    setCached(cacheKey, data, 900);
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Source', 'fmp');
    return res.json(data);
  } catch (e) {
    console.error('Macro Tier2 (FMP) failed:', e.message);
  }

  res.status(500).json({ error: 'All macro sources failed' });
};
