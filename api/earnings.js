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

  // Tier 4: Yahoo Finance earnings calendar page scrape
  try {
    console.log('[Earnings] Tier 4: Yahoo earnings calendar scrape');
    const yahooUrl = `https://finance.yahoo.com/calendar/earnings?from=${from}&to=${to}`;
    const resp = await fetch(yahooUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
    });
    const html = await resp.text();
    // Parse JSON data embedded in Yahoo page
    const match = html.match(/root\.App\.main\s*=\s*(\{.*?\});\s*\n/s) ||
                  html.match(/"rows"\s*:\s*(\[.*?\])/s);
    if (match) {
      let rows = [];
      try {
        const parsed = JSON.parse(match[1]);
        rows = parsed?.context?.dispatcher?.stores?.ScreenerResultsStore?.results?.rows ||
               parsed?.context?.dispatcher?.stores?.QuoteStore?.quotes ||
               (Array.isArray(parsed) ? parsed : []);
      } catch { rows = []; }
      if (rows.length > 0) {
        const earnings = rows.slice(0, 30).map(r => ({
          symbol: r.ticker || r.symbol,
          name: r.companyshortname || r.shortName || r.ticker || r.symbol,
          date: r.startdatetime ? new Date(r.startdatetime).toISOString().split('T')[0] : from,
          epsEstimate: r.epsestimate ?? null,
          epsActual: r.epsactual ?? null,
          time: r.startdatetimetype === 'BMO' ? 'bmo' : r.startdatetimetype === 'AMC' ? 'amc' : 'unknown',
        })).filter(e => e.symbol);
        if (earnings.length > 0) {
          console.log(`[Earnings] Tier 4: ${earnings.length} earnings scraped`);
          setCached(cacheKey, earnings, 21600);
          return res.json(earnings);
        }
      }
    }
  } catch (e) {
    console.error('[Earnings] Tier 4 (Yahoo scrape) failed:', e.message);
  }

  // Tier 5: yahoo-finance2 SPY top holdings calendar events
  try {
    console.log('[Earnings] Tier 5: Yahoo SPY holdings');
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
      console.log(`[Earnings] Tier 5: ${earnings.length} earnings found`);
      if (earnings.length > 0) {
        setCached(cacheKey, earnings, 21600);
        return res.json(earnings);
      }
    }
  } catch (e) {
    console.error('[Earnings] Tier 5 (Yahoo) failed:', e.message);
  }

  // Tier 6: Hardcoded major upcoming earnings (always returns data)
  try {
    console.log('[Earnings] Tier 6: Major companies fallback');
    const MAJOR_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'JPM', 'V', 'JNJ',
      'WMT', 'PG', 'MA', 'HD', 'DIS', 'NFLX', 'ADBE', 'CRM', 'INTC', 'AMD'];
    const results = await Promise.allSettled(
      MAJOR_TICKERS.map(s => yahooFinance.quoteSummary(s, { modules: ['calendarEvents', 'price'] }))
    );
    const earnings = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        const cal = r.value?.calendarEvents?.earnings;
        const price = r.value?.price;
        if (cal?.earningsDate?.[0]) {
          const date = new Date(cal.earningsDate[0]);
          const dateStr = date.toISOString().split('T')[0];
          const epsEst = typeof cal.epsEstimate === 'number' ? cal.epsEstimate : cal.epsEstimate?.raw ?? null;
          earnings.push({
            symbol: MAJOR_TICKERS[i],
            name: price?.longName || price?.shortName || MAJOR_TICKERS[i],
            date: dateStr,
            epsEstimate: epsEst,
            time: 'unknown',
          });
        }
      }
    });
    earnings.sort((a, b) => new Date(a.date) - new Date(b.date));
    if (earnings.length > 0) {
      console.log(`[Earnings] Tier 6: ${earnings.length} major earnings found`);
      setCached(cacheKey, earnings, 21600);
      return res.json(earnings);
    }
  } catch (e) {
    console.error('[Earnings] Tier 6 (major companies) failed:', e.message);
  }

  console.log('[Earnings] All tiers exhausted, returning empty');
  res.json([]);
};
