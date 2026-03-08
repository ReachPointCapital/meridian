const { getCached, setCached } = require('./_cache');
const { FMP_KEY, FMP_BASE } = require('./_helpers');
const yahooFinance = require('yahoo-finance2').default;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const today = new Date();
  const from = today.toISOString().split('T')[0];
  const sixtyDays = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
  const to = sixtyDays.toISOString().split('T')[0];

  const cacheKey = `ipos_${from}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  // Tier 1: FMP v3 ipo_calendar
  try {
    const url = `https://financialmodelingprep.com/api/v3/ipo_calendar?from=${from}&to=${to}&apikey=${FMP_KEY}`;
    console.log('[IPOs] Tier 1:', url);
    const response = await fetch(url);
    console.log('[IPOs] Tier 1 status:', response.status);
    if (response.status === 401 || response.status === 403) {
      console.error('[IPOs] FMP auth error on Tier 1');
    }
    const text = await response.text();
    console.log('[IPOs] Tier 1 raw:', text.substring(0, 500));
    const data = JSON.parse(text);
    if (Array.isArray(data) && data.length > 0) {
      setCached(cacheKey, data, 86400);
      return res.json(data);
    }
  } catch (e) {
    console.error('[IPOs] Tier 1 failed:', e.message);
  }

  // Tier 2: FMP v3 ipo-calendar-prospectus
  try {
    const url = `https://financialmodelingprep.com/api/v3/ipo-calendar-prospectus?from=${from}&to=${to}&apikey=${FMP_KEY}`;
    console.log('[IPOs] Tier 2:', url);
    const response = await fetch(url);
    console.log('[IPOs] Tier 2 status:', response.status);
    if (response.status === 401 || response.status === 403) {
      console.error('[IPOs] FMP auth error on Tier 2');
    }
    const text = await response.text();
    console.log('[IPOs] Tier 2 raw:', text.substring(0, 500));
    const data = JSON.parse(text);
    if (Array.isArray(data) && data.length > 0) {
      setCached(cacheKey, data, 86400);
      return res.json(data);
    }
  } catch (e) {
    console.error('[IPOs] Tier 2 failed:', e.message);
  }

  // Tier 3: FMP v3 ipo-calendar-confirmed
  try {
    const url = `https://financialmodelingprep.com/api/v3/ipo-calendar-confirmed?from=${from}&to=${to}&apikey=${FMP_KEY}`;
    console.log('[IPOs] Tier 3:', url);
    const response = await fetch(url);
    console.log('[IPOs] Tier 3 status:', response.status);
    const text = await response.text();
    console.log('[IPOs] Tier 3 raw:', text.substring(0, 500));
    const data = JSON.parse(text);
    if (Array.isArray(data) && data.length > 0) {
      setCached(cacheKey, data, 86400);
      return res.json(data);
    }
  } catch (e) {
    console.error('[IPOs] Tier 3 failed:', e.message);
  }

  // Tier 4: FMP stable
  try {
    const url = `${FMP_BASE}/ipo_calendar?from=${from}&to=${to}&apikey=${FMP_KEY}`;
    console.log('[IPOs] Tier 4 (stable):', url);
    const response = await fetch(url);
    console.log('[IPOs] Tier 4 status:', response.status);
    const text = await response.text();
    console.log('[IPOs] Tier 4 raw:', text.substring(0, 500));
    const data = JSON.parse(text);
    if (Array.isArray(data) && data.length > 0) {
      setCached(cacheKey, data, 86400);
      return res.json(data);
    }
  } catch (e) {
    console.error('[IPOs] Tier 4 failed:', e.message);
  }

  // Tier 5: Yahoo screener fallback
  try {
    console.log('[IPOs] Tier 5: Yahoo screener');
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
    console.error('[IPOs] Tier 5 (Yahoo screener) failed:', e.message);
  }

  console.log('[IPOs] All tiers exhausted, returning empty');
  res.json([]);
};
