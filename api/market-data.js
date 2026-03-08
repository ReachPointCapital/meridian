const { getCached, setCached } = require('./_cache');
const { yahooCrypto } = require('./_yahoo');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// ── Forex pairs ──
const FOREX_PAIRS = [
  { symbol: 'EURUSD=X', label: 'EUR/USD' },
  { symbol: 'GBPUSD=X', label: 'GBP/USD' },
  { symbol: 'USDJPY=X', label: 'USD/JPY' },
  { symbol: 'USDCAD=X', label: 'USD/CAD' },
  { symbol: 'AUDUSD=X', label: 'AUD/USD' },
  { symbol: 'USDCHF=X', label: 'USD/CHF' },
  { symbol: 'CNY=X', label: 'USD/CNY' },
  { symbol: 'KRW=X', label: 'USD/KRW' },
  { symbol: 'INR=X', label: 'USD/INR' },
];

// ── Commodities ──
const COMMODITIES = [
  { symbol: 'CL=F', name: 'Crude Oil WTI', category: 'Energy' },
  { symbol: 'BZ=F', name: 'Brent Crude', category: 'Energy' },
  { symbol: 'NG=F', name: 'Natural Gas', category: 'Energy' },
  { symbol: 'RB=F', name: 'Gasoline RBOB', category: 'Energy' },
  { symbol: 'GC=F', name: 'Gold', category: 'Metals' },
  { symbol: 'SI=F', name: 'Silver', category: 'Metals' },
  { symbol: 'HG=F', name: 'Copper', category: 'Metals' },
  { symbol: 'PL=F', name: 'Platinum', category: 'Metals' },
  { symbol: 'ZC=F', name: 'Corn', category: 'Agriculture' },
  { symbol: 'ZW=F', name: 'Wheat', category: 'Agriculture' },
  { symbol: 'ZS=F', name: 'Soybeans', category: 'Agriculture' },
  { symbol: 'KC=F', name: 'Coffee', category: 'Agriculture' },
  { symbol: 'SB=F', name: 'Sugar', category: 'Agriculture' },
  { symbol: 'CT=F', name: 'Cotton', category: 'Agriculture' },
  { symbol: 'LE=F', name: 'Live Cattle', category: 'Agriculture' },
  { symbol: 'LBS=F', name: 'Lumber', category: 'Agriculture' },
];

// ── Global indices ──
const INDICES = [
  { symbol: '^GSPC', name: 'S&P 500', region: 'US' },
  { symbol: '^NDX', name: 'NASDAQ 100', region: 'US' },
  { symbol: '^DJI', name: 'Dow Jones', region: 'US' },
  { symbol: '^RUT', name: 'Russell 2000', region: 'US' },
  { symbol: '^VIX', name: 'VIX', region: 'US' },
  { symbol: '^FTSE', name: 'FTSE 100', region: 'Europe' },
  { symbol: '^GDAXI', name: 'DAX', region: 'Europe' },
  { symbol: '^FCHI', name: 'CAC 40', region: 'Europe' },
  { symbol: '^STOXX50E', name: 'Euro Stoxx 50', region: 'Europe' },
  { symbol: '^N225', name: 'Nikkei 225', region: 'Asia' },
  { symbol: '^HSI', name: 'Hang Seng', region: 'Asia' },
  { symbol: '000001.SS', name: 'Shanghai Composite', region: 'Asia' },
  { symbol: '^KS11', name: 'KOSPI', region: 'Asia' },
  { symbol: '^BSESN', name: 'BSE Sensex', region: 'Asia' },
  { symbol: '^BVSP', name: 'Bovespa', region: 'Americas' },
  { symbol: '^GSPTSE', name: 'TSX Composite', region: 'Americas' },
  { symbol: '^MXX', name: 'IPC Mexico', region: 'Americas' },
  { symbol: '^AXJO', name: 'ASX 200', region: 'Asia' },
];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  const { type } = req.query;

  // ── commodities ──
  if (type === 'commodities') {
    const cacheKey = 'commodities';
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);
    try {
      const results = await Promise.allSettled(COMMODITIES.map(c => yahooFinance.quote(c.symbol)));
      const data = COMMODITIES.map((c, i) => {
        const r = results[i];
        if (r.status === 'fulfilled' && r.value) {
          const q = r.value;
          return { symbol: c.symbol, name: c.name, category: c.category, price: q.regularMarketPrice, change: q.regularMarketChange, changePercent: q.regularMarketChangePercent, previousClose: q.regularMarketPreviousClose };
        }
        console.warn(`[Commodities] ${c.symbol} (${c.name}) failed:`, r.status === 'rejected' ? r.reason?.message : 'no data');
        return { symbol: c.symbol, name: c.name, category: c.category, price: null, change: null, changePercent: null };
      });
      const valid = data.filter(d => d.price !== null);
      setCached(cacheKey, valid.length > 0 ? valid : data, 300);
      return res.json(valid.length > 0 ? valid : data);
    } catch (e) {
      console.error('Commodities error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  // ── crypto ──
  if (type === 'crypto') {
    const cacheKey = 'crypto_quotes';
    const cached = getCached(cacheKey);
    if (cached) { res.setHeader('X-Cache', 'HIT'); return res.json(cached); }
    try {
      const data = await yahooCrypto();
      if (!data || data.length === 0) throw new Error('Yahoo returned no crypto quotes');
      setCached(cacheKey, data, 300); res.setHeader('X-Cache', 'MISS'); return res.json(data);
    } catch (error) {
      console.error('Crypto fetch failed:', error.message);
      return res.status(500).json({ error: 'Failed to fetch crypto data' });
    }
  }

  // ── forex ──
  if (type === 'forex') {
    const cacheKey = 'forex_major';
    const cached = getCached(cacheKey);
    if (cached) { res.setHeader('X-Cache', 'HIT'); return res.json(cached); }
    try {
      console.log('[Forex] Fetching', FOREX_PAIRS.map(p => p.symbol).join(', '));
      const results = await Promise.allSettled(FOREX_PAIRS.map(p => yahooFinance.quote(p.symbol)));
      const data = FOREX_PAIRS.map((p, i) => {
        const r = results[i];
        if (r.status === 'fulfilled' && r.value) {
          const rate = r.value.regularMarketPrice ?? null;
          console.log(`[Forex] ${p.label}: rate=${rate}, change=${r.value.regularMarketChangePercent}`);
          return { pair: p.label, symbol: p.symbol, ticker: p.label, rate, price: rate, change: r.value.regularMarketChange ?? null, changePercent: r.value.regularMarketChangePercent ?? null, changesPercentage: r.value.regularMarketChangePercent ?? null };
        }
        console.warn(`[Forex] ${p.label} failed:`, r.status === 'rejected' ? r.reason?.message : 'no data');
        return { pair: p.label, symbol: p.symbol, ticker: p.label, rate: null, price: null, change: null, changePercent: null, changesPercentage: null };
      });
      setCached(cacheKey, data, 900); res.setHeader('X-Cache', 'MISS'); return res.json(data);
    } catch (err) {
      console.error('Forex endpoint error:', err.message);
      return res.status(500).json({ error: 'Forex data temporarily unavailable' });
    }
  }

  // ── globalindices ──
  if (type === 'globalindices') {
    const cacheKey = 'global_indices';
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);
    try {
      const results = await Promise.allSettled(INDICES.map(idx => yahooFinance.quote(idx.symbol)));
      const data = INDICES.map((idx, i) => {
        const r = results[i];
        if (r.status === 'fulfilled' && r.value) {
          const q = r.value;
          return { symbol: idx.symbol, name: idx.name, region: idx.region, price: q.regularMarketPrice ?? null, change: q.regularMarketChange ?? null, changePercent: q.regularMarketChangePercent ?? null, previousClose: q.regularMarketPreviousClose ?? null, marketState: q.marketState ?? 'CLOSED' };
        }
        if (r.status === 'rejected') console.error(`Global index ${idx.symbol} (${idx.name}) failed:`, r.reason?.message || r.reason);
        return { symbol: idx.symbol, name: idx.name, region: idx.region, price: null, change: null, changePercent: null, marketState: 'CLOSED' };
      });
      setCached(cacheKey, data, 300);
      return res.json(data);
    } catch (e) {
      console.error('Global indices error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(400).json({ error: 'Invalid type. Expected: commodities, crypto, forex, globalindices' });
};
