const { getCached, setCached } = require('./_cache');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

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
      const result = await yahooFinance.quoteSummary(symbol, {
        modules: [
          'incomeStatementHistory',
          'cashflowStatementHistory',
          'balanceSheetHistory',
          'defaultKeyStatistics',
          'financialData',
          'summaryDetail',
        ]
      });

      const incomeRaw = result.incomeStatementHistory?.incomeStatementHistory || [];
      const incomeStatement = [...incomeRaw].reverse().map(s => ({
        date: s.endDate,
        year: s.endDate ? new Date(s.endDate).getFullYear() : null,
        revenue: s.totalRevenue,
        costOfRevenue: s.costOfRevenue,
        grossProfit: s.grossProfit,
        grossMargin: s.totalRevenue ? s.grossProfit / s.totalRevenue : null,
        researchAndDevelopmentExpenses: s.researchDevelopment,
        sellingAndMarketingExpenses: null,
        generalAndAdministrativeExpenses: s.sellingGeneralAdministrative,
        operatingExpenses: s.totalOperatingExpenses,
        ebit: s.operatingIncome || s.ebit,
        ebitMargin: s.totalRevenue ? (s.operatingIncome || s.ebit) / s.totalRevenue : null,
        ebitda: s.ebitda,
        interestIncome: null,
        interestExpense: s.interestExpense,
        totalOtherIncomeExpensesNet: s.totalOtherIncomeExpenseNet,
        incomeBeforeTax: s.incomeBeforeTax,
        incomeTaxExpense: s.incomeTaxExpense,
        taxRate: s.incomeBeforeTax ? s.incomeTaxExpense / s.incomeBeforeTax : null,
        netIncome: s.netIncome,
        netMargin: s.totalRevenue ? s.netIncome / s.totalRevenue : null,
        eps: s.dilutedEPS,
        weightedAverageShsOutDil: s.dilutedAverageShares,
      }));

      const cfRaw = result.cashflowStatementHistory?.cashflowStatements || [];
      const cashFlow = [...cfRaw].reverse().map(s => ({
        date: s.endDate,
        year: s.endDate ? new Date(s.endDate).getFullYear() : null,
        netIncome: s.netIncome,
        depreciationAndAmortization: s.depreciation,
        stockBasedCompensation: s.stockBasedCompensation,
        changeInWorkingCapital: s.changeToOperatingActivities,
        accountsReceivables: s.changeToAccountReceivables,
        inventory: s.changeToInventory,
        accountsPayables: null,
        otherWorkingCapital: null,
        operatingCashFlow: s.totalCashFromOperatingActivities,
        capitalExpenditure: s.capitalExpenditures,
        acquisitionsNet: s.acquisitionsNet,
        otherInvestingActivites: s.otherCashflowsFromInvestingActivities,
        freeCashFlow: s.totalCashFromOperatingActivities && s.capitalExpenditures
          ? s.totalCashFromOperatingActivities + s.capitalExpenditures : null,
        dividendsPaid: s.dividendsPaid,
        commonStockRepurchased: s.repurchaseOfStock,
        debtRepayment: s.netBorrowings,
        netCashUsedProvidedByFinancingActivities: s.totalCashFromFinancingActivities,
        netChangeInCash: s.changeInCash,
        cashAtBeginningOfPeriod: null,
        cashAtEndOfPeriod: s.cash,
      }));

      const bsRaw = result.balanceSheetHistory?.balanceSheetStatements || [];
      const balanceSheet = [...bsRaw].reverse().map(s => ({
        date: s.endDate,
        year: s.endDate ? new Date(s.endDate).getFullYear() : null,
        cashAndCashEquivalents: s.cash,
        netReceivables: s.netReceivables,
        inventory: s.inventory,
        otherCurrentAssets: s.otherCurrentAssets,
        totalCurrentAssets: s.totalCurrentAssets,
        propertyPlantEquipmentNet: s.propertyPlantEquipment,
        goodwillAndIntangibleAssets: (s.goodWill || 0) + (s.intangibleAssets || 0),
        goodwill: s.goodWill,
        otherNonCurrentAssets: s.otherAssets,
        totalAssets: s.totalAssets,
        accountPayables: s.accountsPayable,
        shortTermDebt: s.shortLongTermDebt,
        otherCurrentLiabilities: s.otherCurrentLiab,
        totalCurrentLiabilities: s.totalCurrentLiabilities,
        longTermDebt: s.longTermDebt,
        deferredTaxLiabilitiesNonCurrent: s.deferredLongTermAssetCharges,
        otherNonCurrentLiabilities: s.otherLiab,
        totalLiabilities: s.totalLiab,
        commonStock: s.commonStock,
        additionalPaidInCapital: null,
        retainedEarnings: s.retainedEarnings,
        treasuryStock: s.treasuryStock,
        totalStockholdersEquity: s.totalStockholderEquity,
        totalDebt: s.totalDebt || s.longTermDebt,
      }));

      const stats = result.defaultKeyStatistics || {};
      const financial = result.financialData || {};
      const detail = result.summaryDetail || {};

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
      setCached(cacheKey, output, 3600);
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
