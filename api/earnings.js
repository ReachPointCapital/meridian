const { getCached, setCached } = require('./_cache');
const { FMP_KEY, FMP_BASE } = require('./_helpers');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const today = new Date();
  const from = req.query.from || today.toISOString().split('T')[0];
  const fourteenDays = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
  const to = req.query.to || fourteenDays.toISOString().split('T')[0];
  console.log(`[Earnings] Fetching from=${from} to=${to}`);

  const cacheKey = `earnings_${from}_${to}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  const mapFMP = (e) => ({
    symbol: e.symbol,
    name: e.name || e.symbol,
    date: e.date,
    epsEstimate: e.epsEstimated,
    epsActual: e.eps,
    revenueEstimate: e.revenueEstimated,
    revenueActual: e.revenue,
    time: e.time || 'unknown',
    fiscalDateEnding: e.fiscalDateEnding
  });

  // Tier 1: FMP stable earning_calendar
  try {
    const url = `${FMP_BASE}/earning_calendar?from=${from}&to=${to}&apikey=${FMP_KEY}`;
    console.log('[Earnings] Tier 1:', url);
    const response = await fetch(url);
    console.log('[Earnings] Tier 1 status:', response.status);
    if (response.status === 401 || response.status === 403) {
      console.error('[Earnings] FMP auth error on Tier 1');
    }
    const text = await response.text();
    console.log('[Earnings] Tier 1 raw:', text.substring(0, 500));
    const data = JSON.parse(text);
    if (Array.isArray(data) && data.length > 0) {
      const mapped = data.map(mapFMP);
      setCached(cacheKey, mapped, 21600);
      return res.json(mapped);
    }
  } catch (e) {
    console.error('[Earnings] Tier 1 failed:', e.message);
  }

  // Tier 2: FMP v3 earning_calendar
  try {
    const url = `https://financialmodelingprep.com/api/v3/earning_calendar?from=${from}&to=${to}&apikey=${FMP_KEY}`;
    console.log('[Earnings] Tier 2:', url);
    const response = await fetch(url);
    console.log('[Earnings] Tier 2 status:', response.status);
    if (response.status === 401 || response.status === 403) {
      console.error('[Earnings] FMP auth error on Tier 2');
    }
    const text = await response.text();
    console.log('[Earnings] Tier 2 raw:', text.substring(0, 500));
    const data = JSON.parse(text);
    if (Array.isArray(data) && data.length > 0) {
      const mapped = data.map(mapFMP);
      setCached(cacheKey, mapped, 21600);
      return res.json(mapped);
    }
  } catch (e) {
    console.error('[Earnings] Tier 2 failed:', e.message);
  }

  // Tier 3: FMP v3 without date params (returns upcoming)
  try {
    const url = `https://financialmodelingprep.com/api/v3/earning_calendar?apikey=${FMP_KEY}`;
    console.log('[Earnings] Tier 3 (no dates):', url);
    const response = await fetch(url);
    console.log('[Earnings] Tier 3 status:', response.status);
    const text = await response.text();
    console.log('[Earnings] Tier 3 raw:', text.substring(0, 500));
    const data = JSON.parse(text);
    if (Array.isArray(data) && data.length > 0) {
      // Filter to only upcoming dates
      const upcoming = data.filter(e => e.date >= from);
      if (upcoming.length > 0) {
        const mapped = upcoming.map(mapFMP);
        setCached(cacheKey, mapped, 21600);
        return res.json(mapped);
      }
    }
  } catch (e) {
    console.error('[Earnings] Tier 3 failed:', e.message);
  }

  // Tier 4: Yahoo SPY top holdings calendar events
  try {
    console.log('[Earnings] Tier 4: Yahoo SPY holdings');
    const spyHoldings = await yahooFinance.quoteSummary('SPY', { modules: ['topHoldings'] });
    const tickers = (spyHoldings?.topHoldings?.holdings || [])
      .map(h => h.symbol)
      .filter(Boolean)
      .slice(0, 50);

    if (tickers.length > 0) {
      const results = await Promise.allSettled(
        tickers.map(s => yahooFinance.quoteSummary(s, { modules: ['calendarEvents'] }))
      );
      const earnings = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          const events = r.value?.calendarEvents?.earnings;
          if (events?.earningsDate?.[0]) {
            const date = new Date(events.earningsDate[0]);
            const dateStr = date.toISOString().split('T')[0];
            if (dateStr >= from && dateStr <= to) {
              const epsEst = typeof events.epsEstimate === 'number'
                ? events.epsEstimate
                : events.epsEstimate?.raw ?? null;
              earnings.push({
                symbol: tickers[i],
                name: tickers[i],
                date: dateStr,
                epsEstimate: epsEst,
                time: 'unknown'
              });
            }
          }
        }
      });
      console.log(`[Earnings] Tier 4: ${earnings.length} earnings found`);
      if (earnings.length > 0) {
        setCached(cacheKey, earnings, 21600);
        return res.json(earnings);
      }
    }
  } catch (e) {
    console.error('[Earnings] Tier 4 (Yahoo) failed:', e.message);
  }

  console.log('[Earnings] All tiers exhausted, returning empty');
  res.json([]);
};
