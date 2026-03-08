const { getCached, setCached } = require('./_cache');
const { FMP_KEY, FMP_BASE } = require('./_helpers');
const { yahooFullAnalysis, yahooAnalyst, yahooProfile, yahooEarnings } = require('./_yahoo');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// ── Earnings calendar mapper ──
const mapFMPEarning = (e) => ({
  symbol: e.symbol, name: e.name || e.symbol, date: e.date,
  epsEstimate: e.epsEstimated, epsActual: e.eps,
  revenueEstimate: e.revenueEstimated, revenueActual: e.revenue,
  time: e.time || 'unknown', fiscalDateEnding: e.fiscalDateEnding,
});

// ── Shorts screener IDs ──
const SHORTS_SCREENER_IDS = ['most_shorted_stocks', 'short_squeeze_stocks', 'aggressive_small_caps'];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  const { type } = req.query;

  // ── analysis ──
  if (type === 'analysis') {
    const { symbol } = req.query;
    if (!symbol) return res.status(400).json({ error: 'symbol required' });
    const cacheKey = `analysis_${symbol}`;
    const cached = getCached(cacheKey);
    if (cached) { res.setHeader('X-Cache', 'HIT'); return res.json(cached); }
    try {
      const data = await yahooFullAnalysis(symbol);
      setCached(cacheKey, data, 3600); res.setHeader('X-Cache', 'MISS'); return res.json(data);
    } catch (error) {
      console.error(`Analysis failed for ${symbol}:`, error.message);
      return res.status(500).json({ error: 'Failed to fetch analysis data' });
    }
  }

  // ── analyst ──
  if (type === 'analyst') {
    const { symbol } = req.query;
    if (!symbol) return res.status(400).json({ error: 'symbol required' });
    const cacheKey = `analyst_${symbol}`;
    const cached = getCached(cacheKey);
    if (cached) { res.setHeader('X-Cache', 'HIT'); return res.json(cached); }
    try {
      const data = await yahooAnalyst(symbol);
      setCached(cacheKey, data, 3600); res.setHeader('X-Cache', 'MISS'); return res.json(data);
    } catch (error) {
      console.error(`Analyst failed for ${symbol}:`, error.message);
      return res.status(500).json({ error: 'Failed to fetch analyst data' });
    }
  }

  // ── profile ──
  if (type === 'profile') {
    const { symbol } = req.query;
    if (!symbol) return res.status(400).json({ error: 'symbol required' });
    const cacheKey = `profile_${symbol}`;
    const cached = getCached(cacheKey);
    if (cached) { res.setHeader('X-Cache', 'HIT'); return res.json(cached); }
    try {
      const data = await yahooProfile(symbol);
      setCached(cacheKey, data, 86400); res.setHeader('X-Cache', 'MISS'); res.setHeader('X-Source', 'yahoo'); return res.json(data);
    } catch (e) { console.error('Profile Tier1 (Yahoo) failed:', e.message); }
    try {
      const response = await fetch(`${FMP_BASE}/profile?symbol=${encodeURIComponent(symbol)}&apikey=${FMP_KEY}`);
      const data = await response.json();
      setCached(cacheKey, data, 86400); res.setHeader('X-Cache', 'MISS'); res.setHeader('X-Source', 'fmp'); return res.json(data);
    } catch (e) { console.error('Profile Tier2 (FMP) failed:', e.message); }
    return res.status(500).json({ error: 'All profile sources failed' });
  }

  // ── earnings (calendar) ──
  if (type === 'earnings') {
    const today = new Date();
    const from = req.query.from || today.toISOString().split('T')[0];
    const fourteenDays = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
    const to = req.query.to || fourteenDays.toISOString().split('T')[0];
    console.log(`[Earnings] Fetching from=${from} to=${to}`);
    const cacheKey = `earnings_${from}_${to}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    // Tier 1: FMP stable
    try {
      const url = `${FMP_BASE}/earning_calendar?from=${from}&to=${to}&apikey=${FMP_KEY}`;
      console.log('[Earnings] Tier 1:', url);
      const response = await fetch(url);
      console.log('[Earnings] Tier 1 status:', response.status);
      if (response.status === 401 || response.status === 403) console.error('[Earnings] FMP auth error on Tier 1');
      const text = await response.text();
      console.log('[Earnings] Tier 1 raw:', text.substring(0, 500));
      const data = JSON.parse(text);
      if (Array.isArray(data) && data.length > 0) { const mapped = data.map(mapFMPEarning); setCached(cacheKey, mapped, 21600); return res.json(mapped); }
    } catch (e) { console.error('[Earnings] Tier 1 failed:', e.message); }

    // Tier 2: FMP v3
    try {
      const url = `https://financialmodelingprep.com/api/v3/earning_calendar?from=${from}&to=${to}&apikey=${FMP_KEY}`;
      console.log('[Earnings] Tier 2:', url);
      const response = await fetch(url);
      console.log('[Earnings] Tier 2 status:', response.status);
      if (response.status === 401 || response.status === 403) console.error('[Earnings] FMP auth error on Tier 2');
      const text = await response.text();
      console.log('[Earnings] Tier 2 raw:', text.substring(0, 500));
      const data = JSON.parse(text);
      if (Array.isArray(data) && data.length > 0) { const mapped = data.map(mapFMPEarning); setCached(cacheKey, mapped, 21600); return res.json(mapped); }
    } catch (e) { console.error('[Earnings] Tier 2 failed:', e.message); }

    // Tier 3: FMP v3 without date params
    try {
      const url = `https://financialmodelingprep.com/api/v3/earning_calendar?apikey=${FMP_KEY}`;
      console.log('[Earnings] Tier 3 (no dates):', url);
      const response = await fetch(url);
      console.log('[Earnings] Tier 3 status:', response.status);
      const text = await response.text();
      console.log('[Earnings] Tier 3 raw:', text.substring(0, 500));
      const data = JSON.parse(text);
      if (Array.isArray(data) && data.length > 0) {
        const upcoming = data.filter(e => e.date >= from);
        if (upcoming.length > 0) { const mapped = upcoming.map(mapFMPEarning); setCached(cacheKey, mapped, 21600); return res.json(mapped); }
      }
    } catch (e) { console.error('[Earnings] Tier 3 failed:', e.message); }

    // Tier 4: Yahoo Finance earnings calendar page scrape
    try {
      console.log('[Earnings] Tier 4: Yahoo earnings calendar scrape');
      const yahooUrl = `https://finance.yahoo.com/calendar/earnings?from=${from}&to=${to}`;
      const resp = await fetch(yahooUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' } });
      const html = await resp.text();
      const match = html.match(/root\.App\.main\s*=\s*(\{.*?\});\s*\n/s) || html.match(/"rows"\s*:\s*(\[.*?\])/s);
      if (match) {
        let rows = [];
        try {
          const parsed = JSON.parse(match[1]);
          rows = parsed?.context?.dispatcher?.stores?.ScreenerResultsStore?.results?.rows || parsed?.context?.dispatcher?.stores?.QuoteStore?.quotes || (Array.isArray(parsed) ? parsed : []);
        } catch { rows = []; }
        if (rows.length > 0) {
          const earnings = rows.slice(0, 30).map(r => ({
            symbol: r.ticker || r.symbol, name: r.companyshortname || r.shortName || r.ticker || r.symbol,
            date: r.startdatetime ? new Date(r.startdatetime).toISOString().split('T')[0] : from,
            epsEstimate: r.epsestimate ?? null, epsActual: r.epsactual ?? null,
            time: r.startdatetimetype === 'BMO' ? 'bmo' : r.startdatetimetype === 'AMC' ? 'amc' : 'unknown',
          })).filter(e => e.symbol);
          if (earnings.length > 0) { console.log(`[Earnings] Tier 4: ${earnings.length} earnings scraped`); setCached(cacheKey, earnings, 21600); return res.json(earnings); }
        }
      }
    } catch (e) { console.error('[Earnings] Tier 4 (Yahoo scrape) failed:', e.message); }

    // Tier 5: yahoo-finance2 SPY top holdings
    try {
      console.log('[Earnings] Tier 5: Yahoo SPY holdings');
      const spyHoldings = await yahooFinance.quoteSummary('SPY', { modules: ['topHoldings'] });
      const tickers = (spyHoldings?.topHoldings?.holdings || []).map(h => h.symbol).filter(Boolean).slice(0, 50);
      if (tickers.length > 0) {
        const results = await Promise.allSettled(tickers.map(s => yahooFinance.quoteSummary(s, { modules: ['calendarEvents'] })));
        const earnings = [];
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') {
            const events = r.value?.calendarEvents?.earnings;
            if (events?.earningsDate?.[0]) {
              const date = new Date(events.earningsDate[0]); const dateStr = date.toISOString().split('T')[0];
              if (dateStr >= from && dateStr <= to) {
                const epsEst = typeof events.epsEstimate === 'number' ? events.epsEstimate : events.epsEstimate?.raw ?? null;
                earnings.push({ symbol: tickers[i], name: tickers[i], date: dateStr, epsEstimate: epsEst, time: 'unknown' });
              }
            }
          }
        });
        console.log(`[Earnings] Tier 5: ${earnings.length} earnings found`);
        if (earnings.length > 0) { setCached(cacheKey, earnings, 21600); return res.json(earnings); }
      }
    } catch (e) { console.error('[Earnings] Tier 5 (Yahoo) failed:', e.message); }

    // Tier 6: Hardcoded major upcoming earnings
    try {
      console.log('[Earnings] Tier 6: Major companies fallback');
      const MAJOR_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'JPM', 'V', 'JNJ', 'WMT', 'PG', 'MA', 'HD', 'DIS', 'NFLX', 'ADBE', 'CRM', 'INTC', 'AMD'];
      const results = await Promise.allSettled(MAJOR_TICKERS.map(s => yahooFinance.quoteSummary(s, { modules: ['calendarEvents', 'price'] })));
      const earnings = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          const cal = r.value?.calendarEvents?.earnings; const price = r.value?.price;
          if (cal?.earningsDate?.[0]) {
            const date = new Date(cal.earningsDate[0]); const dateStr = date.toISOString().split('T')[0];
            const epsEst = typeof cal.epsEstimate === 'number' ? cal.epsEstimate : cal.epsEstimate?.raw ?? null;
            earnings.push({ symbol: MAJOR_TICKERS[i], name: price?.longName || price?.shortName || MAJOR_TICKERS[i], date: dateStr, epsEstimate: epsEst, time: 'unknown' });
          }
        }
      });
      earnings.sort((a, b) => new Date(a.date) - new Date(b.date));
      if (earnings.length > 0) { console.log(`[Earnings] Tier 6: ${earnings.length} major earnings found`); setCached(cacheKey, earnings, 21600); return res.json(earnings); }
    } catch (e) { console.error('[Earnings] Tier 6 (major companies) failed:', e.message); }

    console.log('[Earnings] All tiers exhausted, returning empty');
    return res.json([]);
  }

  // ── earningshistory ──
  if (type === 'earningshistory') {
    const { symbol } = req.query;
    if (!symbol) return res.status(400).json({ error: 'symbol required' });
    const cacheKey = `earnings_history_${symbol}`;
    const cached = getCached(cacheKey);
    if (cached) { res.setHeader('X-Cache', 'HIT'); return res.json(cached); }
    try {
      const data = await yahooEarnings(symbol);
      setCached(cacheKey, data, 3600); res.setHeader('X-Cache', 'MISS'); return res.json(data);
    } catch (error) {
      console.error(`Earnings history failed for ${symbol}:`, error.message);
      return res.status(500).json({ error: 'Failed to fetch earnings history' });
    }
  }

  // ── shorts ──
  if (type === 'shorts') {
    const cacheKey = 'most_shorted';
    const cached = getCached(cacheKey);
    if (cached) { res.setHeader('X-Cache', 'HIT'); return res.json(cached); }

    for (const scrId of SHORTS_SCREENER_IDS) {
      try {
        const result = await yahooFinance.screener({ scrIds: scrId, count: 20 });
        const quotes = result.quotes || [];
        if (quotes.length > 0) {
          const data = quotes.map(q => ({
            ticker: q.symbol, name: q.longName || q.shortName || q.symbol,
            price: q.regularMarketPrice, changePercent: q.regularMarketChangePercent,
            shortPercentOfFloat: q.shortPercentOfFloat ?? null, shortRatio: q.shortRatio ?? null,
          }));
          setCached(cacheKey, data, 3600); res.setHeader('X-Cache', 'MISS'); res.setHeader('X-Source', `yahoo-${scrId}`); return res.json(data);
        }
      } catch (e) { console.error(`Shorts screener "${scrId}" failed:`, e.message); }
    }

    try {
      const result = await yahooFinance.screener({ scrIds: 'most_actives', count: 25 });
      const quotes = result.quotes || [];
      if (quotes.length > 0) {
        const enriched = await Promise.allSettled(
          quotes.slice(0, 20).map(async (q) => {
            try {
              const summary = await yahooFinance.quoteSummary(q.symbol, { modules: ['defaultKeyStatistics', 'price'] });
              const stats = summary.defaultKeyStatistics || {};
              const spf = stats.shortPercentOfFloat?.raw ?? stats.shortPercentOfFloat ?? null;
              const sr = stats.shortRatio?.raw ?? stats.shortRatio ?? null;
              return { ticker: q.symbol, name: q.longName || q.shortName || q.symbol, price: q.regularMarketPrice, changePercent: q.regularMarketChangePercent, shortPercentOfFloat: spf, shortRatio: sr };
            } catch {
              return { ticker: q.symbol, name: q.longName || q.shortName || q.symbol, price: q.regularMarketPrice, changePercent: q.regularMarketChangePercent, shortPercentOfFloat: null, shortRatio: null };
            }
          })
        );
        const data = enriched.filter(r => r.status === 'fulfilled').map(r => r.value).filter(d => d.ticker).sort((a, b) => (b.shortPercentOfFloat || 0) - (a.shortPercentOfFloat || 0));
        if (data.length > 0) { setCached(cacheKey, data, 3600); res.setHeader('X-Cache', 'MISS'); res.setHeader('X-Source', 'yahoo-actives-enriched'); return res.json(data); }
      }
    } catch (e) { console.error('Shorts actives enrichment failed:', e.message); }

    return res.json({ data: [], message: 'Short interest data temporarily unavailable' });
  }

  return res.status(400).json({ error: 'Invalid type. Expected: analysis, analyst, profile, earnings, earningshistory, shorts' });
};
