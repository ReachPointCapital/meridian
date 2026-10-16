const { getCached, setCached } = require('./_cache');
const { yf: yahooFinance } = require('./_yf');
const { getModelStatements } = require('./_fundamentals');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { symbol, type = 'income', period = 'annual' } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  // Full model data mode — returns all statements + keyStats in one call
  if (type === 'all') {
    const cacheKey = `financials_all_${symbol}`;
    const cached = getCached(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    try {
      // Statements come from fundamentalsTimeSeries (the old quoteSummary statement modules return zeros).
      // Key statistics are a bonus: ETFs and crypto have none, and that must not sink the statements.
      const [statementsResult, summaryResult] = await Promise.allSettled([
        getModelStatements(symbol),
        yahooFinance.quoteSummary(symbol, { modules: ['defaultKeyStatistics', 'financialData', 'summaryDetail'] }),
      ]);
      if (statementsResult.status === 'rejected') throw statementsResult.reason;
      const { incomeStatement, cashFlow, balanceSheet } = statementsResult.value;

      const summary = summaryResult.status === 'fulfilled' ? summaryResult.value : {};
      const stats = summary.defaultKeyStatistics || {};
      const financial = summary.financialData || {};
      const detail = summary.summaryDetail || {};

      const keyStats = {
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

      const output = { incomeStatement, cashFlow, balanceSheet, keyStats, ticker: symbol.toUpperCase() };
      // Never pin an empty answer in the cache: a blip would stick for an hour.
      if (incomeStatement.length > 0) setCached(cacheKey, output, 3600);
      res.setHeader('X-Cache', 'MISS');
      return res.json(output);

    } catch (error) {
      console.error('Yahoo financials (all) error:', error.message);
      res.status(500).json({ error: error.message });
    }
    return;
  }

  // Legacy single-type mode (used by Analysis page)
  const cacheKey = `financials_${symbol}_${type}_${period}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  try {
    const { yahooFinancials } = require('./_yahoo');
    const data = await yahooFinancials(symbol, period);
    const result = type === 'balance' ? data.balance
      : type === 'cashflow' ? data.cashflow
      : data.income;
    if (result && result.length > 0) {
      setCached(cacheKey, result, 86400);
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Source', 'yahoo');
      return res.json(result);
    }
    throw new Error('Yahoo returned empty financials');
  } catch (e) {
    console.error('Financials (Yahoo) failed:', e.message);
    res.status(500).json({ error: 'Financials fetch failed' });
  }
};
