const { getCached, setCached } = require('./_cache');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

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

  const cacheKey = 'global_indices';
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const results = await Promise.allSettled(
      INDICES.map(idx => yahooFinance.quote(idx.symbol))
    );

    const data = INDICES.map((idx, i) => {
      const r = results[i];
      if (r.status === 'fulfilled' && r.value) {
        const q = r.value;
        return {
          symbol: idx.symbol,
          name: idx.name,
          region: idx.region,
          price: q.regularMarketPrice ?? null,
          change: q.regularMarketChange ?? null,
          changePercent: q.regularMarketChangePercent ?? null,
          previousClose: q.regularMarketPreviousClose ?? null,
          marketState: q.marketState ?? 'CLOSED',
        };
      }
      if (r.status === 'rejected') {
        console.error(`Global index ${idx.symbol} (${idx.name}) failed:`, r.reason?.message || r.reason);
      }
      return { symbol: idx.symbol, name: idx.name, region: idx.region, price: null, change: null, changePercent: null, marketState: 'CLOSED' };
    });

    setCached(cacheKey, data, 300);
    res.json(data);
  } catch (e) {
    console.error('Global indices error:', e.message);
    res.status(500).json({ error: e.message });
  }
};
