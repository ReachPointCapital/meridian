const { getCached, setCached } = require('./_cache');
const { FMP_KEY, FMP_BASE } = require('./_helpers');
const { yahooQuote, yahooQuotes } = require('./_yahoo');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  const isMulti = symbol.includes(',');

  if (isMulti) {
    const symbols = symbol.split(',').map(s => s.trim()).filter(Boolean);
    const cacheKey = `quote_multi_${symbols.sort().join(',')}`;
    const cached = getCached(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    // Tier 1: Yahoo batch
    try {
      const data = await yahooQuotes(symbols);
      if (data && data.length > 0) {
        setCached(cacheKey, data, 900);
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('X-Source', 'yahoo');
        return res.json(data);
      }
      throw new Error('No results from Yahoo batch');
    } catch (e) {
      console.error('Quote Tier1 (Yahoo batch) failed:', e.message);
    }

    // Tier 2: FMP batch
    try {
      const response = await fetch(`${FMP_BASE}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${FMP_KEY}`);
      const data = await response.json();
      setCached(cacheKey, data, 900);
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Source', 'fmp');
      return res.json(data);
    } catch (e) {
      console.error('Quote Tier2 (FMP batch) failed:', e.message);
    }

    return res.status(500).json({ error: 'All quote sources failed' });
  }

  // Single symbol path
  const cacheKey = `quote_${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  // Tier 1: Yahoo
  try {
    const data = await yahooQuote(symbol);
    setCached(cacheKey, data, 900);
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Source', 'yahoo');
    return res.json(data);
  } catch (e) {
    console.error('Quote Tier1 (Yahoo) failed:', e.message);
  }

  // Tier 2: FMP
  try {
    const response = await fetch(`${FMP_BASE}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${FMP_KEY}`);
    const data = await response.json();
    setCached(cacheKey, data, 900);
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Source', 'fmp');
    return res.json(data);
  } catch (e) {
    console.error('Quote Tier2 (FMP) failed:', e.message);
  }

  res.status(500).json({ error: 'All quote sources failed' });
};
