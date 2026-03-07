const { getCached, setCached } = require('./_cache');
const yahooFinance = require('yahoo-finance2').default;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { q } = req.query;
  if (!q || q.length < 1) return res.json([]);

  const cacheKey = `search_${q.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const results = await yahooFinance.search(q, {
      newsCount: 0,
      quotesCount: 12,
      enableFuzzyQuery: true,
      enableEnhancedTrivialQuery: true
    });
    const qLower = q.toLowerCase();
    const quotes = (results.quotes || [])
      .filter(r => r.quoteType === 'EQUITY' || r.quoteType === 'ETF' || r.quoteType === 'CRYPTOCURRENCY')
      .map(r => ({
        symbol: r.symbol,
        name: r.longname || r.shortname || r.symbol,
        exchange: r.exchDisp || r.exchange,
        type: r.quoteType
      }))
      // Boost exact symbol matches and company name matches to top
      .sort((a, b) => {
        const aSymMatch = a.symbol.toLowerCase() === qLower ? -2 : (a.symbol.toLowerCase().startsWith(qLower) ? -1 : 0);
        const bSymMatch = b.symbol.toLowerCase() === qLower ? -2 : (b.symbol.toLowerCase().startsWith(qLower) ? -1 : 0);
        const aNameMatch = a.name.toLowerCase().includes(qLower) ? -1 : 0;
        const bNameMatch = b.name.toLowerCase().includes(qLower) ? -1 : 0;
        return (aSymMatch + aNameMatch) - (bSymMatch + bNameMatch);
      })
      .slice(0, 8);
    setCached(cacheKey, quotes, 3600);
    res.json(quotes);
  } catch (e) {
    // Fallback to FMP
    try {
      const { FMP_KEY, FMP_BASE } = require('./_helpers');
      const url = `${FMP_BASE}/search-symbol?query=${encodeURIComponent(q)}&apikey=${FMP_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      const mapped = (Array.isArray(data) ? data : []).slice(0, 8).map(r => ({
        symbol: r.symbol,
        name: r.name || r.symbol,
        exchange: r.exchangeShortName || r.exchange,
        type: 'EQUITY'
      }));
      setCached(cacheKey, mapped, 3600);
      res.json(mapped);
    } catch {
      res.status(500).json({ error: e.message });
    }
  }
};
