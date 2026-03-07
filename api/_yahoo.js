const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

async function yahooQuote(symbol) {
  const quote = await yahooFinance.quote(symbol);
  return {
    symbol: quote.symbol,
    name: quote.longName || quote.shortName || symbol,
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

async function yahooFinancials(symbol, period = 'annual') {
  const modules = period === 'annual'
    ? ['incomeStatementHistory', 'balanceSheetHistory', 'cashflowStatementHistory']
    : ['incomeStatementHistoryQuarterly', 'balanceSheetHistoryQuarterly', 'cashflowStatementHistoryQuarterly'];
  const result = await yahooFinance.quoteSummary(symbol, { modules });

  const mapIncome = (stmt) => ({
    date: stmt.endDate,
    revenue: stmt.totalRevenue,
    costOfRevenue: stmt.costOfRevenue,
    grossProfit: stmt.grossProfit,
    operatingExpenses: stmt.totalOperatingExpenses,
    operatingIncome: stmt.operatingIncome,
    netIncome: stmt.netIncome,
    ebitda: stmt.ebitda,
    eps: stmt.dilutedEPS,
    epsDiluted: stmt.dilutedEPS,
    researchAndDevelopmentExpenses: stmt.researchDevelopment
  });
  const mapBalance = (stmt) => ({
    date: stmt.endDate,
    totalAssets: stmt.totalAssets,
    totalCurrentAssets: stmt.totalCurrentAssets,
    cashAndCashEquivalents: stmt.cash,
    totalLiabilities: stmt.totalLiab,
    totalCurrentLiabilities: stmt.totalCurrentLiabilities,
    totalDebt: stmt.totalDebt || stmt.longTermDebt,
    totalEquity: stmt.totalStockholderEquity,
    retainedEarnings: stmt.retainedEarnings
  });
  const mapCashFlow = (stmt) => ({
    date: stmt.endDate,
    operatingCashFlow: stmt.totalCashFromOperatingActivities,
    capitalExpenditure: stmt.capitalExpenditures,
    freeCashFlow: stmt.freeCashFlow ||
      (stmt.totalCashFromOperatingActivities && stmt.capitalExpenditures
        ? stmt.totalCashFromOperatingActivities + stmt.capitalExpenditures : null),
    dividendsPaid: stmt.dividendsPaid,
    netCashUsedForInvestingActivites: stmt.totalCashflowsFromInvestingActivities
  });

  const key = period === 'annual' ? '' : 'Quarterly';
  const income = result[`incomeStatementHistory${key}`]?.incomeStatementHistory?.map(mapIncome) || [];
  const balance = result[`balanceSheetHistory${key}`]?.balanceSheetStatements?.map(mapBalance) || [];
  const cashflow = result[`cashflowStatementHistory${key}`]?.cashflowStatements?.map(mapCashFlow) || [];
  return { income, balance, cashflow };
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
  } catch { return []; }
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
  const results = await Promise.allSettled(symbols.map(s => yahooQuote(s)));
  return results.filter(r => r.status === 'fulfilled').map(r => r.value);
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
  } catch { return []; }
}

async function yahooSectors() {
  const sectorETFs = {
    'Technology': 'XLK', 'Healthcare': 'XLV', 'Financials': 'XLF',
    'Energy': 'XLE', 'Consumer Discretionary': 'XLY', 'Consumer Staples': 'XLP',
    'Industrials': 'XLI', 'Materials': 'XLB', 'Real Estate': 'XLRE',
    'Utilities': 'XLU', 'Communication Services': 'XLC'
  };
  const symbols = Object.values(sectorETFs);
  const quotes = await Promise.allSettled(symbols.map(s => yahooFinance.quote(s)));
  const result = {};
  Object.entries(sectorETFs).forEach(([sector, etf], i) => {
    const q = quotes[i];
    if (q.status === 'fulfilled' && q.value) {
      result[sector] = (q.value.regularMarketChangePercent || 0).toFixed(2) + '%';
    }
  });
  return result;
}

async function yahooYields() {
  const yieldSymbols = { '3M': '^IRX', '2Y': '2YY=F', '5Y': '^FVX', '10Y': '^TNX', '30Y': '^TYX' };
  const results = await Promise.allSettled(
    Object.entries(yieldSymbols).map(async ([maturity, sym]) => {
      const q = await yahooFinance.quote(sym);
      return { maturity, yield: q.regularMarketPrice, change: q.regularMarketChangePercent };
    })
  );
  return results.filter(r => r.status === 'fulfilled').map(r => r.value);
}

async function yahooCrypto() {
  const cryptos = [
    { symbol: 'BTC-USD', name: 'Bitcoin', ticker: 'BTC' },
    { symbol: 'ETH-USD', name: 'Ethereum', ticker: 'ETH' },
    { symbol: 'SOL-USD', name: 'Solana', ticker: 'SOL' },
    { symbol: 'XRP-USD', name: 'XRP', ticker: 'XRP' },
    { symbol: 'ADA-USD', name: 'Cardano', ticker: 'ADA' }
  ];
  const results = await Promise.allSettled(cryptos.map(c => yahooFinance.quote(c.symbol)));
  return cryptos.map((c, i) => {
    const r = results[i];
    if (r.status === 'fulfilled') {
      return {
        ...c, price: r.value.regularMarketPrice, change: r.value.regularMarketChange,
        changePercent: r.value.regularMarketChangePercent, marketCap: r.value.marketCap,
        volume: r.value.regularMarketVolume
      };
    }
    return { ...c, price: null };
  }).filter(c => c.price !== null);
}

async function yahooMacro() {
  const instruments = [
    // US Indices
    { symbol: 'SPY', label: 'S&P 500' }, { symbol: 'QQQ', label: 'NASDAQ 100' },
    { symbol: 'DIA', label: 'Dow Jones' }, { symbol: 'IWM', label: 'Russell 2000' },
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
    { symbol: '^IRX', label: '2Y Yield' }, { symbol: '^TYX', label: '30Y Yield' },
    { symbol: 'GBPUSD=X', label: 'GBP/USD' }, { symbol: 'JPY=X', label: 'USD/JPY' },
    // Digital Assets
    { symbol: 'BTC-USD', label: 'Bitcoin' }, { symbol: 'ETH-USD', label: 'Ethereum' },
    { symbol: 'SOL-USD', label: 'Solana' }, { symbol: 'XRP-USD', label: 'XRP' },
    { symbol: 'ADA-USD', label: 'Cardano' },
    { symbol: 'DOGE-USD', label: 'Dogecoin' }, { symbol: 'BNB-USD', label: 'BNB' },
    { symbol: 'AVAX-USD', label: 'Avalanche' },
  ];
  const results = await Promise.allSettled(instruments.map(inst => yahooFinance.quote(inst.symbol)));
  return instruments.map((inst, i) => {
    const r = results[i];
    if (r.status === 'fulfilled' && r.value) {
      return {
        symbol: inst.symbol, label: inst.label,
        price: r.value.regularMarketPrice, change: r.value.regularMarketChange,
        changePercent: r.value.regularMarketChangePercent
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
  yahooQuote, yahooProfile, yahooChart, yahooFinancials,
  yahooNews, yahooGeneralNews, yahooQuotes, yahooAnalyst, yahooEarnings,
  yahooScreener, yahooSectors, yahooYields, yahooCrypto, yahooMacro, yahooFullAnalysis
};
