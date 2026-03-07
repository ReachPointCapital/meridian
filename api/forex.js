const { getCached, setCached } = require('./_cache');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const PAIRS = [
  { symbol: 'EURUSD=X', label: 'EUR/USD' },
  { symbol: 'GBPUSD=X', label: 'GBP/USD' },
  { symbol: 'USDJPY=X', label: 'USD/JPY' },
  { symbol: 'USDCAD=X', label: 'USD/CAD' },
  { symbol: 'AUDUSD=X', label: 'AUD/USD' },
  { symbol: 'USDCHF=X', label: 'USD/CHF' },
];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const cacheKey = 'forex_major';
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  try {
    console.log('[Forex] Fetching', PAIRS.map(p => p.symbol).join(', '));
    const results = await Promise.allSettled(PAIRS.map(p => yahooFinance.quote(p.symbol)));
    const data = PAIRS.map((p, i) => {
      const r = results[i];
      if (r.status === 'fulfilled' && r.value) {
        const rate = r.value.regularMarketPrice ?? null;
        console.log(`[Forex] ${p.label}: rate=${rate}, change=${r.value.regularMarketChangePercent}`);
        return {
          pair: p.label,
          symbol: p.symbol,
          ticker: p.label,
          rate,
          price: rate,
          change: r.value.regularMarketChange ?? null,
          changePercent: r.value.regularMarketChangePercent ?? null,
          changesPercentage: r.value.regularMarketChangePercent ?? null,
        };
      }
      console.warn(`[Forex] ${p.label} failed:`, r.status === 'rejected' ? r.reason?.message : 'no data');
      return { pair: p.label, symbol: p.symbol, ticker: p.label, rate: null, price: null, change: null, changePercent: null, changesPercentage: null };
    });

    setCached(cacheKey, data, 900);
    res.setHeader('X-Cache', 'MISS');
    res.json(data);
  } catch (err) {
    console.error('Forex endpoint error:', err.message);
    res.status(500).json({ error: 'Forex data temporarily unavailable' });
  }
};
