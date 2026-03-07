const { getCached, setCached } = require('./_cache');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// Top ~100 S&P 500 components by market cap weight
const SP500_STOCKS = [
  'AAPL','MSFT','NVDA','AMZN','GOOGL','META','BRK-B','LLY','AVGO','TSLA',
  'WMT','JPM','V','UNH','XOM','ORCL','MA','COST','HD','PG','JNJ','ABBV',
  'BAC','NFLX','KO','CRM','CVX','MRK','AMD','PEP','TMO','ACN','LIN','MCD',
  'ABT','TXN','CSCO','DHR','NKE','PM','NEE','ADBE','INTC','UNP','AMGN','T',
  'RTX','HON','GE','LOW','UPS','SPGI','CAT','ISRG','QCOM','GS','BLK','AXP',
  'DE','INTU','MS','SBUX','GILD','MDT','ADI','VRTX','REGN','MMC','PLD','CI',
  'SYK','BSX','CB','SCHW','AMAT','MO','EOG','SO','DUK','CME','ZTS','ITW',
  'NOC','EMR','AON','PNC','USB','WM','TJX','FCX','SLB','APD','COP','KLAC',
];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const cacheKey = 'heatmap_data';
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const results = await Promise.allSettled(
      SP500_STOCKS.map(s => yahooFinance.quote(s))
    );

    const data = SP500_STOCKS.map((symbol, i) => ({
      symbol,
      name: results[i].status === 'fulfilled' ? (results[i].value?.longName || results[i].value?.shortName || symbol) : symbol,
      marketCap: results[i].status === 'fulfilled' ? (results[i].value?.marketCap || 0) : 0,
      price: results[i].status === 'fulfilled' ? results[i].value?.regularMarketPrice ?? null : null,
      changePercent: results[i].status === 'fulfilled' ? results[i].value?.regularMarketChangePercent ?? null : null,
    }));

    setCached(cacheKey, data, 900);
    return res.json(data);
  } catch (e) {
    console.error('Heatmap error:', e.message);
    res.status(500).json({ error: e.message });
  }
};
