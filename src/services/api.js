const BASE = '';

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  quote: (symbol) => get(`${BASE}/api/market?type=quote&symbol=${encodeURIComponent(symbol)}`),
  quotes: (symbols) => get(`${BASE}/api/market?type=quote&symbol=${encodeURIComponent(Array.isArray(symbols) ? symbols.join(',') : symbols)}`),
  profile: (symbol) => get(`${BASE}/api/company?type=profile&symbol=${encodeURIComponent(symbol)}`),
  chart: (symbol, timeframe) => get(`${BASE}/api/chart?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`),
  financials: (symbol, type, period) => get(`${BASE}/api/financials?symbol=${encodeURIComponent(symbol)}&type=${type}&period=${period}`),
  news: (symbol) => get(`${BASE}/api/content?type=news${symbol ? `&symbol=${encodeURIComponent(symbol)}` : ''}`),
  generalNews: () => get(`${BASE}/api/content?type=news`),
  earnings: (from, to) => get(`${BASE}/api/company?type=earnings&from=${from}&to=${to}`),
  earningsHistory: (symbol) => get(`${BASE}/api/company?type=earningshistory&symbol=${encodeURIComponent(symbol)}`),
  analyst: (symbol) => get(`${BASE}/api/company?type=analyst&symbol=${encodeURIComponent(symbol)}`),
  search: (q) => get(`${BASE}/api/search?q=${encodeURIComponent(q)}`),
  gainers: () => get(`${BASE}/api/market?type=gainers`),
  losers: () => get(`${BASE}/api/market?type=losers`),
  actives: () => get(`${BASE}/api/market?type=actives`),
  sectors: () => get(`${BASE}/api/market?type=sectors`),
  macro: () => get(`${BASE}/api/dashboard?type=macro`),
  economicCalendar: (from, to) => get(`${BASE}/api/dashboard?type=calendar&from=${from}&to=${to}`),
  analysis: (symbol) => get(`${BASE}/api/company?type=analysis&symbol=${encodeURIComponent(symbol)}`),
  fearGreed: () => get(`${BASE}/api/dashboard?type=feargreed`),
  crypto: () => get(`${BASE}/api/market-data?type=crypto`),
  yields: () => get(`${BASE}/api/dashboard?type=yields`),
  forex: () => get(`${BASE}/api/market-data?type=forex`),
  shorts: () => get(`${BASE}/api/company?type=shorts`),
  ipos: () => get(`${BASE}/api/dashboard?type=ipos`),
  article: (url) => get(`${BASE}/api/content?type=article&url=${encodeURIComponent(url)}`),
  globalIndices: () => get(`${BASE}/api/market-data?type=globalindices`),
  commodities: () => get(`${BASE}/api/market-data?type=commodities`),
  centralBanks: () => get(`${BASE}/api/dashboard?type=centralbanks`),
  m2: () => get(`${BASE}/api/dashboard?type=m2`),
  economicReleases: () => get(`${BASE}/api/dashboard?type=releases`),
  dailyBrief: () => get(`${BASE}/api/content?type=dailybrief`),
  heatmap: () => get(`${BASE}/api/market?type=heatmap`),
  modelData: (symbol) => get(`${BASE}/api/model-data?symbol=${encodeURIComponent(symbol)}`),
  modelFinancials: (symbol) => get(`${BASE}/api/financials?symbol=${encodeURIComponent(symbol)}&type=all`),
  peers: (symbol) => get(`${BASE}/api/model-data?symbol=${encodeURIComponent(symbol)}`),
};
