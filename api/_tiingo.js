const TIINGO_KEY = process.env.TIINGO_KEY;
const TIINGO_BASE = 'https://api.tiingo.com';

async function tiingoQuote(symbol) {
  const res = await fetch(`${TIINGO_BASE}/tiingo/daily/${symbol}/prices?token=${TIINGO_KEY}`);
  if (!res.ok) throw new Error(`Tiingo quote failed: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error('Tiingo: no data');
  const latest = data[data.length - 1];
  return {
    symbol: symbol.toUpperCase(),
    price: latest.close,
    open: latest.open,
    high: latest.high,
    low: latest.low,
    volume: latest.volume,
    previousClose: latest.adjClose,
    change: latest.close - latest.adjClose,
    changesPercentage: ((latest.close - latest.adjClose) / latest.adjClose) * 100,
    source: 'tiingo'
  };
}

async function tiingoNews(symbol) {
  const url = symbol
    ? `${TIINGO_BASE}/tiingo/news?tickers=${symbol}&limit=20&token=${TIINGO_KEY}`
    : `${TIINGO_BASE}/tiingo/news?limit=20&token=${TIINGO_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Tiingo news failed: ${res.status}`);
  const data = await res.json();
  return data.map(item => ({
    title: item.title,
    url: item.url,
    publishedDate: item.publishedDate,
    site: item.source,
    text: item.description,
    source: 'tiingo'
  }));
}

async function tiingoChart(symbol, startDate, endDate, resampleFreq = 'daily') {
  const res = await fetch(`${TIINGO_BASE}/tiingo/daily/${symbol}/prices?startDate=${startDate}&endDate=${endDate}&resampleFreq=${resampleFreq}&token=${TIINGO_KEY}`);
  if (!res.ok) throw new Error(`Tiingo chart failed: ${res.status}`);
  const data = await res.json();
  return data.map(bar => ({
    t: new Date(bar.date).getTime(),
    o: bar.open,
    h: bar.high,
    l: bar.low,
    c: bar.close,
    v: bar.volume,
  }));
}

module.exports = { tiingoQuote, tiingoNews, tiingoChart };
