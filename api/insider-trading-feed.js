const { getCached, setCached } = require('./_cache');
const { FMP_KEY, FMP_BASE } = require('./_helpers');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const cacheKey = 'insider_trading_feed';
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  const mapTrade = (t) => ({
    symbol: t.symbol,
    owner: t.reportingName || t.reportingCik || 'Unknown',
    transactionType: t.transactionType || 'N/A',
    shares: t.securitiesTransacted,
    price: t.price,
    value: (t.securitiesTransacted || 0) * (t.price || 0),
    date: t.filingDate || t.transactionDate,
  });

  // Option A: v4 insider-trading with transactionType filter
  try {
    const url = `https://financialmodelingprep.com/api/v4/insider-trading?transactionType=P-Purchase,S-Sale&limit=20&apikey=${FMP_KEY}`;
    console.log('[InsiderFeed] Option A:', url);
    const response = await fetch(url);
    console.log('[InsiderFeed] Option A status:', response.status);
    if (response.status === 401 || response.status === 403) {
      console.error('[InsiderFeed] FMP auth error on Option A');
    }
    const data = await response.json();
    console.log('[InsiderFeed] Option A raw:', JSON.stringify(data).substring(0, 500));
    if (Array.isArray(data) && data.length > 0) {
      const mapped = data.slice(0, 20).map(mapTrade);
      setCached(cacheKey, mapped, 1800);
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Source', 'fmp-v4-feed');
      return res.json(mapped);
    }
  } catch (e) {
    console.error('[InsiderFeed] Option A failed:', e.message);
  }

  // Option B: Per-symbol fetch for top 10 tickers using stable API (known working pattern)
  const TOP_SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'JPM', 'V', 'UNH'];
  try {
    console.log('[InsiderFeed] Option B: fetching per-symbol for', TOP_SYMBOLS.join(','));
    const results = await Promise.allSettled(
      TOP_SYMBOLS.map(async (sym) => {
        const url = `${FMP_BASE}/insider-trading?symbol=${sym}&limit=3&apikey=${FMP_KEY}`;
        const r = await fetch(url);
        if (r.status === 401 || r.status === 403) {
          console.error(`[InsiderFeed] FMP auth error for ${sym}`);
          return [];
        }
        const d = await r.json();
        console.log(`[InsiderFeed] Option B ${sym}: ${Array.isArray(d) ? d.length : 'not array'} results`);
        return Array.isArray(d) ? d : [];
      })
    );
    const allTrades = [];
    results.forEach(r => {
      if (r.status === 'fulfilled') allTrades.push(...r.value);
    });
    console.log(`[InsiderFeed] Option B total trades: ${allTrades.length}`);
    if (allTrades.length > 0) {
      allTrades.sort((a, b) => new Date(b.filingDate || b.transactionDate || 0) - new Date(a.filingDate || a.transactionDate || 0));
      const mapped = allTrades.slice(0, 15).map(mapTrade);
      setCached(cacheKey, mapped, 1800);
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Source', 'fmp-per-symbol');
      return res.json(mapped);
    }
  } catch (e) {
    console.error('[InsiderFeed] Option B failed:', e.message);
  }

  // Option C: insider-roaster-statistic (different data shape)
  try {
    const url = `https://financialmodelingprep.com/api/v4/insider-roaster-statistic?symbol=AAPL&apikey=${FMP_KEY}`;
    console.log('[InsiderFeed] Option C:', url);
    const response = await fetch(url);
    const data = await response.json();
    console.log('[InsiderFeed] Option C raw:', JSON.stringify(data).substring(0, 500));
  } catch (e) {
    console.error('[InsiderFeed] Option C failed:', e.message);
  }

  console.log('[InsiderFeed] All options exhausted, returning empty');
  res.json([]);
};
