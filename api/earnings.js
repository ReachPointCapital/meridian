const { getCached, setCached } = require('./_cache');
const { FMP_KEY } = require('./_helpers');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const today = new Date();
  const from = req.query.from || today.toISOString().split('T')[0];
  const thirtyDays = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const to = req.query.to || thirtyDays.toISOString().split('T')[0];
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

  // Tier 1-6: FMP endpoints (various spellings/versions)
  const fmpUrls = [
    `https://financialmodelingprep.com/stable/earning_calendar?from=${from}&to=${to}&apikey=${FMP_KEY}`,
    `https://financialmodelingprep.com/stable/earning-calendar?from=${from}&to=${to}&apikey=${FMP_KEY}`,
    `https://financialmodelingprep.com/api/v3/earning_calendar?from=${from}&to=${to}&apikey=${FMP_KEY}`,
    `https://financialmodelingprep.com/api/v3/earning-calendar?from=${from}&to=${to}&apikey=${FMP_KEY}`,
    `https://financialmodelingprep.com/api/v3/earnings-calendar?from=${from}&to=${to}&apikey=${FMP_KEY}`,
    `https://financialmodelingprep.com/api/v4/earning_calendar?from=${from}&to=${to}&apikey=${FMP_KEY}`,
  ];

  for (let i = 0; i < fmpUrls.length; i++) {
    try {
      const response = await fetch(fmpUrls[i]);
      const data = await response.json();
      console.log(`[Earnings] FMP Tier ${i + 1}: status=${response.status}, results=${Array.isArray(data) ? data.length : 'not array'}`);
      if (Array.isArray(data) && data.length > 0) {
        const mapped = data.map(mapFMP);
        setCached(cacheKey, mapped, 21600);
        return res.json(mapped);
      }
    } catch (e) {
      console.error(`Earnings FMP Tier ${i + 1} failed:`, e.message);
    }
  }

  // Tier 6: Dynamic SPY top holdings from Yahoo
  try {
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
      if (earnings.length > 0) {
        setCached(cacheKey, earnings, 21600);
        return res.json(earnings);
      }
    }
  } catch (e) {
    console.error('Earnings Tier 6 (Yahoo SPY holdings) failed:', e.message);
  }

  res.json([]);
};
