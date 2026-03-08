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

  // Tier 6: SEC EDGAR S-1 and 424B4 filings (completely free)
  try {
    console.log('[IPOs] Tier 6: SEC EDGAR S-1/424B4');
    const headers = { 'User-Agent': 'Meridian/1.0 info@reachpointcapital.com' };
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    const [s1Res, prospRes] = await Promise.allSettled([
      fetch(`https://efts.sec.gov/LATEST/search-index?forms=S-1&dateRange=custom&startdt=${thirtyDaysAgo}&enddt=${from}`, { headers }).then(r => r.json()),
      fetch(`https://efts.sec.gov/LATEST/search-index?forms=424B4&dateRange=custom&startdt=${thirtyDaysAgo}&enddt=${from}`, { headers }).then(r => r.json()),
    ]);

    const ipos = [];

    // 424B4 = priced IPOs
    if (prospRes.status === 'fulfilled') {
      const hits = (prospRes.value.hits?.hits || []).slice(0, 8);
      hits.forEach(hit => {
        ipos.push({
          company: hit._source?.display_names?.[0] || hit._source?.entity_name || 'Unknown',
          symbol: '',
          exchange: '',
          date: hit._source?.file_date || '',
          priceRange: 'Priced',
        });
      });
    }

    // S-1 = filed/upcoming
    if (s1Res.status === 'fulfilled') {
      const hits = (s1Res.value.hits?.hits || []).slice(0, 10);
      hits.forEach(hit => {
        const company = hit._source?.display_names?.[0] || hit._source?.entity_name || 'Unknown';
        if (!ipos.find(i => i.company === company)) {
          ipos.push({
            company,
            symbol: '',
            exchange: '',
            date: hit._source?.file_date || '',
            priceRange: 'Filed (S-1)',
          });
        }
      });
    }

    console.log(`[IPOs] Tier 6: ${ipos.length} SEC filings found`);
    if (ipos.length > 0) {
      ipos.sort((a, b) => new Date(b.date) - new Date(a.date));
      setCached(cacheKey, ipos.slice(0, 15), 86400);
      return res.json(ipos.slice(0, 15));
    }
  } catch (e) {
    console.error('[IPOs] Tier 6 (SEC EDGAR) failed:', e.message);
  }

  console.log('[IPOs] All tiers exhausted, returning empty');
  res.json([]);
};
