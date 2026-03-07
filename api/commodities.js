const { getCached, setCached } = require('./_cache');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const COMMODITIES = [
  { symbol: 'CL=F', name: 'Crude Oil WTI', category: 'Energy' },
  { symbol: 'BZ=F', name: 'Brent Crude', category: 'Energy' },
  { symbol: 'NG=F', name: 'Natural Gas', category: 'Energy' },
  { symbol: 'RB=F', name: 'Gasoline RBOB', category: 'Energy' },
  { symbol: 'GC=F', name: 'Gold', category: 'Metals' },
  { symbol: 'SI=F', name: 'Silver', category: 'Metals' },
  { symbol: 'HG=F', name: 'Copper', category: 'Metals' },
  { symbol: 'PL=F', name: 'Platinum', category: 'Metals' },
  { symbol: 'PA=F', name: 'Palladium', category: 'Metals' },
  { symbol: 'ZC=F', name: 'Corn', category: 'Agriculture' },
  { symbol: 'ZW=F', name: 'Wheat', category: 'Agriculture' },
  { symbol: 'ZS=F', name: 'Soybeans', category: 'Agriculture' },
  { symbol: 'KC=F', name: 'Coffee', category: 'Agriculture' },
  { symbol: 'SB=F', name: 'Sugar', category: 'Agriculture' },
  { symbol: 'CT=F', name: 'Cotton', category: 'Agriculture' },
  { symbol: 'LE=F', name: 'Live Cattle', category: 'Agriculture' },
];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const cacheKey = 'commodities';
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const results = await Promise.allSettled(
      COMMODITIES.map(c => yahooFinance.quote(c.symbol))
    );

    const data = COMMODITIES.map((c, i) => {
      const r = results[i];
      if (r.status === 'fulfilled' && r.value) {
        const q = r.value;
        return {
          symbol: c.symbol,
          name: c.name,
          category: c.category,
          price: q.regularMarketPrice,
          change: q.regularMarketChange,
          changePercent: q.regularMarketChangePercent,
          previousClose: q.regularMarketPreviousClose,
        };
      }
      console.warn(`[Commodities] ${c.symbol} (${c.name}) failed:`, r.status === 'rejected' ? r.reason?.message : 'no data');
      return { symbol: c.symbol, name: c.name, category: c.category, price: null, change: null, changePercent: null };
    });

    // Keep items even if price is null — show — in UI
    const valid = data.filter(d => d.price !== null);
    setCached(cacheKey, valid.length > 0 ? valid : data, 300);
    res.json(valid.length > 0 ? valid : data);
  } catch (e) {
    console.error('Commodities error:', e.message);
    res.status(500).json({ error: e.message });
  }
};
