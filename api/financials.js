const { getCached, setCached } = require('./_cache');
const { yf: yahooFinance } = require('./_yf');
const { getModelStatements } = require('./_fundamentals');
const { yahooFinancials } = require('./_yahoo');
const { withApi } = require('./_api');

function buildKeyStats(summary) {
  const stats = summary.defaultKeyStatistics || {};
  const financial = summary.financialData || {};
  const detail = summary.summaryDetail || {};
  return {
    beta: stats.beta,
    sharesOutstanding: stats.sharesOutstanding,
    shortRatio: stats.shortRatio,
    forwardEPS: stats.forwardEps,
    trailingEPS: stats.trailingEps,
    bookValue: stats.bookValue,
    priceToBook: stats.priceToBook,
    enterpriseValue: stats.enterpriseValue,
    evToRevenue: stats.enterpriseToRevenue,
    evToEbitda: stats.enterpriseToEbitda,
    revenueGrowth: financial.revenueGrowth,
    grossMargins: financial.grossMargins,
    ebitdaMargins: financial.ebitdaMargins,
    operatingMargins: financial.operatingMargins,
    profitMargins: financial.profitMargins,
    currentPrice: financial.currentPrice,
    targetMeanPrice: financial.targetMeanPrice,
    recommendationKey: financial.recommendationKey,
    trailingPE: detail.trailingPE,
    forwardPE: detail.forwardPE,
    dividendYield: detail.dividendYield,
    marketCap: detail.marketCap,
  };
}

// Full model data: all three statements plus key statistics in one call (Models page).
async function allStatements(symbol) {
  const cacheKey = `financials_all_${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return { data: cached, hit: true };

  // Statements come from fundamentalsTimeSeries (the old quoteSummary statement modules return zeros).
  // Key statistics are a bonus: ETFs and crypto have none, and that must not sink the statements.
  const [statementsResult, summaryResult] = await Promise.allSettled([
    getModelStatements(symbol),
    yahooFinance.quoteSummary(symbol, { modules: ['defaultKeyStatistics', 'financialData', 'summaryDetail'] }),
  ]);
  if (statementsResult.status === 'rejected') throw statementsResult.reason;
  const { incomeStatement, cashFlow, balanceSheet } = statementsResult.value;

  const keyStats = buildKeyStats(summaryResult.status === 'fulfilled' ? summaryResult.value : {});
  const data = { incomeStatement, cashFlow, balanceSheet, keyStats, ticker: symbol };
  // Never pin an empty answer in the cache: a blip would stick for an hour.
  if (incomeStatement.length > 0) setCached(cacheKey, data, 3600);
  return { data, hit: false };
}

async function handler(req, res) {
  const { symbol, type = 'income', period = 'annual' } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  if (type === 'all') {
    const { data, hit } = await allStatements(symbol);
    res.setHeader('X-Cache', hit ? 'HIT' : 'MISS');
    return res.json(data);
  }

  // Single statement (Analysis page)
  const cacheKey = `financials_${symbol}_${type}_${period}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  const data = await yahooFinancials(symbol, period);
  const result = type === 'balance' ? data.balance : type === 'cashflow' ? data.cashflow : data.income;
  if (!result || result.length === 0) throw new Error('Yahoo returned empty financials');
  setCached(cacheKey, result, 86400);
  res.setHeader('X-Cache', 'MISS');
  res.setHeader('X-Source', 'yahoo');
  return res.json(result);
}

module.exports = withApi(handler, {
  name: 'financials',
  cache: (query) => ({ sMaxAge: query.type === 'all' ? 3600 : 86400, swr: 86400 }),
});
