const { getCached, setCached } = require('./_cache');
const { FMP_KEY } = require('./_helpers');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const cacheKey = 'insider_trading_feed';
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  const mapTrades = (data) => data.slice(0, 30).map(t => ({
    symbol: t.symbol || t.ticker,
    name: t.reportingName || t.reportingCik || t.symbol || t.ticker,
    transactionType: t.transactionType || t.acquistionOrDisposition || 'N/A',
    value: (t.securitiesTransacted || t.securitiesOwned || 0) * (t.price || 0),
    shares: t.securitiesTransacted || t.securitiesOwned,
    price: t.price,
    date: t.filingDate || t.transactionDate || t.date,
    owner: t.reportingName || t.reportingCik,
    ownerType: t.typeOfOwner,
  }));

  const urls = [
    `https://financialmodelingprep.com/stable/insider-trading?limit=30&apikey=${FMP_KEY}`,
    `https://financialmodelingprep.com/api/v4/insider-trading?page=0&apikey=${FMP_KEY}`,
    `https://financialmodelingprep.com/api/v4/insider-trading?transactionType=P-Purchase&limit=30&apikey=${FMP_KEY}`,
    `https://financialmodelingprep.com/api/v4/insider-trading?transactionType=S-Sale&limit=30&apikey=${FMP_KEY}`,
    `https://financialmodelingprep.com/api/v3/insider-trading?limit=30&apikey=${FMP_KEY}`,
    `https://financialmodelingprep.com/stable/insider-trading-rss-feed?limit=30&apikey=${FMP_KEY}`,
  ];

  for (let i = 0; i < urls.length; i++) {
    try {
      const response = await fetch(urls[i]);
      console.log(`[InsiderFeed] Tier ${i + 1}: status=${response.status}`);
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        const mapped = mapTrades(data);
        setCached(cacheKey, mapped, 1800);
        res.setHeader('X-Cache', 'MISS');
        return res.json(mapped);
      }
      console.log(`[InsiderFeed] Tier ${i + 1}: empty or not array (${typeof data})`);
    } catch (e) {
      console.error(`[InsiderFeed] Tier ${i + 1} failed:`, e.message);
    }
  }

  // Tier 2: Try per-symbol for major tickers
  const majorTickers = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'JPM'];
  try {
    const perSymbolUrls = majorTickers.map(sym =>
      `https://financialmodelingprep.com/stable/insider-trading?symbol=${sym}&limit=5&apikey=${FMP_KEY}`
    );
    const results = await Promise.allSettled(perSymbolUrls.map(u => fetch(u).then(r => r.json())));
    const allTrades = [];
    results.forEach(r => {
      if (r.status === 'fulfilled' && Array.isArray(r.value)) {
        allTrades.push(...r.value);
      }
    });
    if (allTrades.length > 0) {
      // Sort by date descending
      allTrades.sort((a, b) => new Date(b.filingDate || b.transactionDate || 0) - new Date(a.filingDate || a.transactionDate || 0));
      const mapped = mapTrades(allTrades);
      setCached(cacheKey, mapped, 1800);
      res.setHeader('X-Cache', 'MISS');
      return res.json(mapped);
    }
  } catch (e) {
    console.error('[InsiderFeed] Per-symbol fallback failed:', e.message);
  }

  res.json([]);
};
