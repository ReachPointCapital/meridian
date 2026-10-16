const { yf: yahooFinance } = require('./_yf');
const { getLegacyStatements } = require('./_fundamentals');

// A raw Yahoo quote in the shape the frontend reads. dividendYield is a percentage (0.32 means 0.32%).
function mapQuote(quote) {
  return {
    symbol: quote.symbol,
    name: quote.longName || quote.shortName || quote.symbol,
    price: quote.regularMarketPrice,
    open: quote.regularMarketOpen,
    high: quote.regularMarketDayHigh,
    low: quote.regularMarketDayLow,
    volume: quote.regularMarketVolume,
    previousClose: quote.regularMarketPreviousClose,
    change: quote.regularMarketChange,
    changesPercentage: quote.regularMarketChangePercent,
    marketCap: quote.marketCap,
    pe: quote.trailingPE,
    forwardPE: quote.forwardPE,
    eps: quote.epsTrailingTwelveMonths,
    yearHigh: quote.fiftyTwoWeekHigh,
    yearLow: quote.fiftyTwoWeekLow,
    avgVolume: quote.averageDailyVolume3Month,
    beta: quote.beta,
    dividendYield: quote.dividendYield ?? null,
    priceToBook: quote.priceToBook,
    exchange: quote.fullExchangeName,
    currency: quote.currency,
    marketState: quote.marketState,
    priceAvg50: quote.fiftyDayAverage,
    priceAvg200: quote.twoHundredDayAverage,
    source: 'yahoo'
  };
}

async function yahooQuote(symbol) {
  return mapQuote(await yahooFinance.quote(symbol));
}

// The quotes for `requested`, in the order asked, skipping any Yahoo did not return.
function quotesInOrder(requested, results) {
  const bySymbol = new Map(results.filter(Boolean).map((q) => [String(q.symbol).toUpperCase(), q]));
  return requested.map((s) => bySymbol.get(String(s).toUpperCase())).filter(Boolean);
}

// Many symbols in a few requests: Yahoo's quote() takes an array, so ~300 symbols are 3 calls instead of 300.
// A failed batch is logged and skipped so it cannot blank the others. If every batch fails it throws instead, so a
// caller can tell an outage (throws) from symbols Yahoo does not know (an empty list).
async function getQuotes(symbols, { client = yahooFinance, chunk = 100 } = {}) {
  const batches = [];
  for (let i = 0; i < symbols.length; i += chunk) batches.push(symbols.slice(i, i + chunk));
  const settled = await Promise.allSettled(batches.map((batch) => client.quote(batch)));
  if (settled.length > 0 && settled.every((r) => r.status === 'rejected')) throw settled[0].reason;
  const out = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') out.push(...(Array.isArray(r.value) ? r.value : [r.value]).filter(Boolean));
    else console.warn(`[yahoo] quote batch ${i + 1}/${batches.length} failed:`, r.reason && r.reason.message);
  });
  return out;
}

async function getQuoteMap(symbols, opts) {
  return new Map((await getQuotes(symbols, opts)).map((q) => [q.symbol, q]));
}

async function yahooProfile(symbol) {
  const result = await yahooFinance.quoteSummary(symbol, {
    modules: ['assetProfile', 'summaryDetail', 'price']
  });
  const profile = result.assetProfile || {};
  const price = result.price || {};
  return {
    symbol,
    companyName: price.longName || price.shortName || symbol,
    description: profile.longBusinessSummary,
    sector: profile.sector,
    industry: profile.industry,
    website: profile.website,
    fullTimeEmployees: profile.fullTimeEmployees,
    city: profile.city,
    state: profile.state,
    country: profile.country,
    ceo: profile.companyOfficers?.[0]?.name,
    ipoDate: null,
    image: `https://financialmodelingprep.com/image-stock/${symbol}.png`,
    source: 'yahoo'
  };
}

async function yahooChart(symbol, period1, interval) {
  const result = await yahooFinance.chart(symbol, { period1, interval, includePrePost: false });
  if (!result || !result.quotes) return [];
  return result.quotes
    .filter(q => q.close !== null)
    .map(q => ({
      t: new Date(q.date).getTime(),
      o: q.open,
      h: q.high,
      l: q.low,
      c: q.close,
      v: q.volume
    }));
}

// Statements come from fundamentalsTimeSeries; the old quoteSummary statement modules now return zeros.
async function yahooFinancials(symbol, period = 'annual') {
  return getLegacyStatements(symbol, period);
}

async function yahooNews(symbol) {
  try {
    const result = await yahooFinance.search(symbol, { newsCount: 20, enableFuzzyQuery: false });
    return (result.news || []).map(item => {
      let publishedDate;
      if (item.providerPublishTime) {
        const ppt = item.providerPublishTime;
        if (ppt instanceof Date) {
          publishedDate = ppt.toISOString();
        } else if (typeof ppt === 'number') {
          // Unix seconds if < 1e12, milliseconds otherwise
          publishedDate = new Date(ppt < 1e12 ? ppt * 1000 : ppt).toISOString();
        } else if (typeof ppt === 'string') {
          publishedDate = new Date(ppt).toISOString();
        }
      }
      return {
        title: item.title,
        url: item.link,
        publishedDate,
        site: item.publisher,
        text: item.title,
        image: item.thumbnail?.resolutions?.[0]?.url || null,
        source: 'yahoo'
      };
    });
  } catch (e) { console.warn(`[yahoo] news failed for ${symbol}:`, e.message); return []; }
}

async function yahooGeneralNews() {
  const symbols = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'TSLA'];
  const allNews = await Promise.all(symbols.map(s => yahooNews(s).catch(() => [])));
  const flat = allNews.flat();
  const seen = new Set();
  return flat.filter(item => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  }).sort((a, b) => new Date(b.publishedDate) - new Date(a.publishedDate)).slice(0, 20);
}

async function yahooQuotes(symbols) {
  return quotesInOrder(symbols, await getQuotes(symbols)).map(mapQuote);
}

async function yahooAnalyst(symbol) {
  const result = await yahooFinance.quoteSummary(symbol, {
    modules: ['recommendationTrend', 'financialData', 'defaultKeyStatistics']
  });
  const trend = result.recommendationTrend?.trend?.[0] || {};
  const financial = result.financialData || {};
  const stats = result.defaultKeyStatistics || {};
  return {
    strongBuy: trend.strongBuy || 0,
    buy: trend.buy || 0,
    hold: trend.hold || 0,
    sell: trend.sell || 0,
    strongSell: trend.strongSell || 0,
    recommendation: financial.recommendationKey || 'none',
    targetHighPrice: financial.targetHighPrice,
    targetLowPrice: financial.targetLowPrice,
    targetMeanPrice: financial.targetMeanPrice,
    numberOfAnalysts: financial.numberOfAnalystOpinions,
    revenueGrowth: financial.revenueGrowth,
    earningsGrowth: financial.earningsGrowth,
    enterpriseValue: stats.enterpriseValue,
    forwardEps: stats.forwardEps,
    pegRatio: stats.pegRatio,
    shortRatio: stats.shortRatio,
    source: 'yahoo'
  };
}

async function yahooEarnings(symbol) {
  const result = await yahooFinance.quoteSummary(symbol, {
    modules: ['earningsHistory', 'earningsTrend']
  });
  return result.earningsHistory?.history?.map(e => ({
    date: e.quarter,
    epsActual: e.epsActual,
    epsEstimate: e.epsEstimate,
    epsDifference: e.epsDifference,
    surprisePercent: e.surprisePercent
  })) || [];
}

async function yahooScreener(scrId, count = 20) {
  try {
    const result = await yahooFinance.screener({ scrIds: scrId, count });
    return (result.quotes || []).map(q => ({
      symbol: q.symbol,
      name: q.longName || q.shortName || q.symbol,
      price: q.regularMarketPrice,
      change: q.regularMarketChange,
      changesPercentage: q.regularMarketChangePercent,
      volume: q.regularMarketVolume,
    }));
  } catch (e) { console.warn(`[yahoo] screener ${scrId} failed:`, e.message); return []; }
}

async function yahooSectors() {
  const sectorETFs = {
    'Technology': 'XLK', 'Healthcare': 'XLV', 'Financials': 'XLF',
    'Energy': 'XLE', 'Consumer Discretionary': 'XLY', 'Consumer Staples': 'XLP',
    'Industrials': 'XLI', 'Materials': 'XLB', 'Real Estate': 'XLRE',
    'Utilities': 'XLU', 'Communication Services': 'XLC'
  };
  const symbols = Object.values(sectorETFs);
  const quotes = await getQuoteMap(symbols);
  const result = {};
  Object.entries(sectorETFs).forEach(([sector, etf]) => {
    const q = quotes.get(etf);
    if (q) result[sector] = (q.regularMarketChangePercent || 0).toFixed(2) + '%';
  });
  return result;
}

async function yahooYields() {
  const yieldSymbols = { '3M': '^IRX', '2Y': '2YY=F', '5Y': '^FVX', '10Y': '^TNX', '30Y': '^TYX' };
  const quotes = await getQuoteMap(Object.values(yieldSymbols));
  return Object.entries(yieldSymbols)
    .filter(([, sym]) => quotes.has(sym))
    .map(([maturity, sym]) => ({ maturity, yield: quotes.get(sym).regularMarketPrice, change: quotes.get(sym).regularMarketChangePercent }));
}

async function yahooCrypto() {
  const cryptos = [
    { symbol: 'BTC-USD', name: 'Bitcoin', ticker: 'BTC' },
    { symbol: 'ETH-USD', name: 'Ethereum', ticker: 'ETH' },
    { symbol: 'SOL-USD', name: 'Solana', ticker: 'SOL' },
    { symbol: 'XRP-USD', name: 'XRP', ticker: 'XRP' },
    { symbol: 'ADA-USD', name: 'Cardano', ticker: 'ADA' }
  ];
  const quotes = await getQuoteMap(cryptos.map(c => c.symbol));
  return cryptos.map((c) => {
    const q = quotes.get(c.symbol);
    if (q) {
      return {
        ...c, price: q.regularMarketPrice, change: q.regularMarketChange,
        changePercent: q.regularMarketChangePercent, marketCap: q.marketCap,
        volume: q.regularMarketVolume
      };
    }
    return { ...c, price: null };
  }).filter(c => c.price !== null);
}

async function yahooMacro() {
  const instruments = [
    // US Indices
    // ETF proxies: label them as ETFs (their price is not the index level)
    { symbol: 'SPY', label: 'S&P 500 ETF (SPY)' }, { symbol: 'QQQ', label: 'NASDAQ 100 ETF (QQQ)' },
    { symbol: 'DIA', label: 'Dow Jones ETF (DIA)' }, { symbol: 'IWM', label: 'Russell 2000 ETF (IWM)' },
    { symbol: '^VIX', label: 'VIX' },
    { symbol: 'ES=F', label: 'S&P Futures' }, { symbol: 'NQ=F', label: 'Nasdaq Futures' },
    { symbol: 'YM=F', label: 'Dow Futures' },
    { symbol: '^SP600', label: 'S&P 600' }, { symbol: '^MID', label: 'S&P 400' },
    { symbol: '^NYA', label: 'NYSE Composite' }, { symbol: '^W5000', label: 'Wilshire 5000' },
    // Commodities & Rates
    { symbol: 'GC=F', label: 'Gold' }, { symbol: 'CL=F', label: 'WTI Oil' },
    { symbol: 'HG=F', label: 'Copper' }, { symbol: '^TNX', label: '10Y Yield' },
    { symbol: 'EURUSD=X', label: 'EUR/USD' },
    { symbol: 'SI=F', label: 'Silver' }, { symbol: 'NG=F', label: 'Natural Gas' },
    { symbol: 'BZ=F', label: 'Brent Crude' },
    { symbol: '^IRX', label: '3M T-Bill Yield' }, { symbol: '^TYX', label: '30Y Yield' },
    { symbol: 'GBPUSD=X', label: 'GBP/USD' }, { symbol: 'JPY=X', label: 'USD/JPY' },
    // Digital Assets
    { symbol: 'BTC-USD', label: 'Bitcoin' }, { symbol: 'ETH-USD', label: 'Ethereum' },
    { symbol: 'SOL-USD', label: 'Solana' }, { symbol: 'XRP-USD', label: 'XRP' },
    { symbol: 'ADA-USD', label: 'Cardano' },
    { symbol: 'DOGE-USD', label: 'Dogecoin' }, { symbol: 'BNB-USD', label: 'BNB' },
    { symbol: 'AVAX-USD', label: 'Avalanche' },
    { symbol: 'LINK-USD', label: 'Chainlink' }, { symbol: 'DOT-USD', label: 'Polkadot' },
    { symbol: 'LTC-USD', label: 'Litecoin' }, { symbol: 'XLM-USD', label: 'Stellar' },
  ];
  const quotes = await getQuoteMap(instruments.map(inst => inst.symbol));
  return instruments.map((inst) => {
    const q = quotes.get(inst.symbol);
    if (q) {
      return {
        symbol: inst.symbol, label: inst.label,
        price: q.regularMarketPrice, change: q.regularMarketChange,
        changePercent: q.regularMarketChangePercent
      };
    }
    return { symbol: inst.symbol, label: inst.label, price: null };
  });
}

async function yahooFullAnalysis(symbol) {
  const [quote, profile, analyst, earnings, financials] = await Promise.allSettled([
    yahooQuote(symbol), yahooProfile(symbol), yahooAnalyst(symbol),
    yahooEarnings(symbol), yahooFinancials(symbol, 'annual')
  ]);
  return {
    quote: quote.status === 'fulfilled' ? quote.value : null,
    profile: profile.status === 'fulfilled' ? profile.value : null,
    analyst: analyst.status === 'fulfilled' ? analyst.value : null,
    earnings: earnings.status === 'fulfilled' ? earnings.value : null,
    financials: financials.status === 'fulfilled' ? financials.value : null
  };
}

module.exports = {
  mapQuote, quotesInOrder, getQuotes, getQuoteMap,
  yahooQuote, yahooProfile, yahooChart, yahooFinancials,
  yahooNews, yahooGeneralNews, yahooQuotes, yahooAnalyst, yahooEarnings,
  yahooScreener, yahooSectors, yahooYields, yahooCrypto, yahooMacro, yahooFullAnalysis
};
