const BASE = '';

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  quote: (symbol) => get(`${BASE}/api/quote?symbol=${encodeURIComponent(symbol)}`),
  quotes: (symbols) => get(`${BASE}/api/quote?symbol=${encodeURIComponent(Array.isArray(symbols) ? symbols.join(',') : symbols)}`),
  profile: (symbol) => get(`${BASE}/api/profile?symbol=${encodeURIComponent(symbol)}`),
  chart: (symbol, timeframe) => get(`${BASE}/api/chart?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`),
  financials: (symbol, type, period) => get(`${BASE}/api/financials?symbol=${encodeURIComponent(symbol)}&type=${type}&period=${period}`),
  news: (symbol) => get(`${BASE}/api/news${symbol ? `?symbol=${encodeURIComponent(symbol)}` : ''}`),
  generalNews: () => get(`${BASE}/api/news`),
  earnings: (from, to) => get(`${BASE}/api/earnings?from=${from}&to=${to}`),
  earningsHistory: (symbol) => get(`${BASE}/api/earnings-history?symbol=${encodeURIComponent(symbol)}`),
  analyst: (symbol) => get(`${BASE}/api/analyst?symbol=${encodeURIComponent(symbol)}`),
  search: (q) => get(`${BASE}/api/search?q=${encodeURIComponent(q)}`),
  gainers: () => get(`${BASE}/api/gainers`),
  losers: () => get(`${BASE}/api/losers`),
  actives: () => get(`${BASE}/api/actives`),
  sectors: () => get(`${BASE}/api/sectors`),
  macro: () => get(`${BASE}/api/macro`),
  economicCalendar: (from, to) => get(`${BASE}/api/economic-calendar?from=${from}&to=${to}`),
  insiderTrading: (symbol) => get(`${BASE}/api/insider-trading?symbol=${encodeURIComponent(symbol)}`),
  analysis: (symbol) => get(`${BASE}/api/analysis?symbol=${encodeURIComponent(symbol)}`),
  fearGreed: () => get(`${BASE}/api/fear-greed`),
  crypto: () => get(`${BASE}/api/crypto`),
  yields: () => get(`${BASE}/api/yields`),
  forex: () => get(`${BASE}/api/forex`),
  shorts: () => get(`${BASE}/api/shorts`),
  ipos: () => get(`${BASE}/api/ipos`),
  article: (url) => get(`${BASE}/api/article?url=${encodeURIComponent(url)}`),
  globalIndices: () => get(`${BASE}/api/global-indices`),
  commodities: () => get(`${BASE}/api/commodities`),
  centralBanks: () => get(`${BASE}/api/central-banks`),
  m2: () => get(`${BASE}/api/m2`),
  insiderTradingFeed: () => get(`${BASE}/api/insider-trading-feed`),
  dailyBrief: () => get(`${BASE}/api/daily-brief`),
  heatmap: () => get(`${BASE}/api/heatmap`),
  modelData: (symbol) => get(`${BASE}/api/model-data?symbol=${encodeURIComponent(symbol)}`),
  peers: (symbol) => get(`${BASE}/api/model-data?symbol=${encodeURIComponent(symbol)}`),
};
