const { getCached, setCached } = require('./_cache');
const { FMP_KEY } = require('./_helpers');
const yahooFinance = require('yahoo-finance2').default;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const today = new Date();
  const from = today.toISOString().split('T')[0];
  const yearOut = new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000);
  const to = yearOut.toISOString().split('T')[0];

  const cacheKey = `ipos_${from}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  // FMP endpoints to try
  const fmpUrls = [
    `https://financialmodelingprep.com/stable/ipos_calendar?from=${from}&to=${to}&apikey=${FMP_KEY}`,
    `https://financialmodelingprep.com/stable/ipos-calendar?from=${from}&to=${to}&apikey=${FMP_KEY}`,
    `https://financialmodelingprep.com/api/v3/ipo_calendar?from=${from}&to=${to}&apikey=${FMP_KEY}`,
    `https://financialmodelingprep.com/api/v3/ipo-calendar-confirmed?from=${from}&to=${to}&apikey=${FMP_KEY}`,
    `https://financialmodelingprep.com/api/v3/ipo-calendar-prospectus?from=${from}&to=${to}&apikey=${FMP_KEY}`,
  ];

  for (let i = 0; i < fmpUrls.length; i++) {
    try {
      const response = await fetch(fmpUrls[i]);
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        setCached(cacheKey, data, 86400);
        return res.json(data);
      }
    } catch (e) {
      console.error(`IPO FMP Tier ${i + 1} failed:`, e.message);
    }
  }

  // Yahoo screener fallback
  try {
    const result = await yahooFinance.screener({ scrIds: 'ipo_upcoming', count: 25 });
    const quotes = result.quotes || [];
    if (quotes.length > 0) {
      const mapped = quotes.map(q => ({
        symbol: q.symbol,
        company: q.longName || q.shortName || q.symbol,
        date: q.ipoExpectedDate || from,
        exchange: q.fullExchangeName || q.exchange,
        priceRange: q.ipoExpectedPrice ? `$${q.ipoExpectedPrice}` : null,
      }));
      setCached(cacheKey, mapped, 86400);
      return res.json(mapped);
    }
  } catch (e) {
    console.error('IPO Yahoo screener failed:', e.message);
  }

  // Yahoo news search fallback
  try {
    const result = await yahooFinance.search('IPO 2025 2026', { newsCount: 15, enableFuzzyQuery: true });
    const news = (result.news || []).map(item => ({
      type: 'news',
      title: item.title,
      url: item.link,
      publishedDate: item.providerPublishTime
        ? new Date(item.providerPublishTime * 1000).toISOString()
        : undefined,
      publisher: item.publisher,
    }));
    if (news.length > 0) {
      setCached(cacheKey, news, 86400);
      return res.json(news);
    }
  } catch (e) {
    console.error('IPO Yahoo news fallback failed:', e.message);
  }

  res.json([]);
};
