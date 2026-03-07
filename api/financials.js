const { getCached, setCached } = require('./_cache');
const { FMP_KEY, FMP_BASE } = require('./_helpers');
const { yahooFinancials } = require('./_yahoo');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { symbol, type = 'income', period = 'annual' } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  const cacheKey = `financials_${symbol}_${type}_${period}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  // Tier 1: Yahoo
  try {
    const data = await yahooFinancials(symbol, period);
    const result = type === 'balance' ? data.balance
      : type === 'cashflow' ? data.cashflow
      : data.income;
    if (result && result.length > 0) {
      setCached(cacheKey, result, 86400);
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Source', 'yahoo');
      return res.json(result);
    }
    throw new Error('Yahoo returned empty financials');
  } catch (e) {
    console.error('Financials Tier1 (Yahoo) failed:', e.message);
  }

  // Tier 2: FMP
  try {
    const endpoints = {
      income: 'income-statement',
      balance: 'balance-sheet-statement',
      cashflow: 'cash-flow-statement',
    };
    const endpoint = endpoints[type] || 'income-statement';
    const limit = period === 'annual' ? 5 : 8;
    const url = `${FMP_BASE}/${endpoint}?symbol=${encodeURIComponent(symbol)}&period=${period}&limit=${limit}&apikey=${FMP_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    setCached(cacheKey, data, 86400);
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Source', 'fmp');
    return res.json(data);
  } catch (e) {
    console.error('Financials Tier2 (FMP) failed:', e.message);
  }

  res.status(500).json({ error: 'All financials sources failed' });
};
