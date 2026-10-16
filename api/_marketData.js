// The instruments behind api/market-data.js and the shapes the commodities, forex and global-index screens read
// (see test/marketdata.test.js). Each list is fetched with one batched quote request.

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

// `quotes` is a Map of symbol -> raw Yahoo quote (see getQuoteMap in _yahoo.js).
function buildCommodities(quotes) {
  const rows = [];
  for (const c of COMMODITIES) {
    const q = quotes.get(c.symbol);
    if (!q || q.regularMarketPrice == null) continue;
    rows.push({
      symbol: c.symbol, name: c.name, category: c.category, price: q.regularMarketPrice,
      change: q.regularMarketChange, changePercent: q.regularMarketChangePercent, previousClose: q.regularMarketPreviousClose,
    });
  }
  return rows;
}

function buildForex(quotes) {
  return FOREX_PAIRS.map((p) => {
    const q = quotes.get(p.symbol) || {};
    const rate = q.regularMarketPrice ?? null;
    const change = q.regularMarketChange ?? null;
    const percent = q.regularMarketChangePercent ?? null;
    return { pair: p.label, symbol: p.symbol, ticker: p.label, rate, price: rate, change, changePercent: percent, changesPercentage: percent };
  });
}

function buildIndices(quotes) {
  return INDICES.map((idx) => {
    const q = quotes.get(idx.symbol) || {};
    return {
      symbol: idx.symbol, name: idx.name, region: idx.region,
      price: q.regularMarketPrice ?? null, change: q.regularMarketChange ?? null, changePercent: q.regularMarketChangePercent ?? null,
      previousClose: q.regularMarketPreviousClose ?? null, marketState: q.marketState ?? 'CLOSED',
    };
  });
}

module.exports = { COMMODITIES, FOREX_PAIRS, INDICES, buildCommodities, buildForex, buildIndices };
