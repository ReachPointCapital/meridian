// Financial statements from Yahoo's fundamentalsTimeSeries endpoint.
//
// Yahoo retired the quoteSummary statement modules (incomeStatementHistory, balanceSheetHistory,
// cashflowStatementHistory): they now return zeros and blanks. fundamentalsTimeSeries is the live source.
// The mappers below are pure so they can be tested against saved rows (see test/fundamentals.test.js).
// Output keys match what the Models, Analysis and Financials pages already read.

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// First finite number among the candidate fields; null when Yahoo has none (never a made-up 0).
function pick(row, ...keys) {
  for (const k of keys) {
    const n = num(row[k]);
    if (n !== null) return n;
  }
  return null;
}

const div = (a, b) => (a !== null && b !== null && b !== 0 ? a / b : null);
const sub = (a, b) => (a !== null && b !== null ? a - b : null);
const sum = (a, b) => (a === null && b === null ? null : (a || 0) + (b || 0));

function isoDate(d) {
  const t = d instanceof Date ? d : typeof d === 'string' || typeof d === 'number' ? new Date(d) : null;
  return t && !Number.isNaN(t.getTime()) ? t.toISOString() : null;
}

const hasData = (row) => Object.entries(row).some(([k, v]) => k !== 'date' && num(v) !== null);

// Usable rows only, oldest first, newest `limit` kept.
function selectRows(rows, limit = 8) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => r && typeof r === 'object' && isoDate(r.date) && hasData(r))
    .sort((a, b) => (isoDate(a.date) < isoDate(b.date) ? -1 : 1))
    .slice(-limit);
}

const base = (row) => {
  const date = isoDate(row.date);
  return { date, year: date ? Number(date.slice(0, 4)) : null };
};

function mapIncome(row) {
  const revenue = pick(row, 'totalRevenue', 'operatingRevenue');
  const grossProfit = pick(row, 'grossProfit');
  const ebit = pick(row, 'EBIT', 'operatingIncome');
  const operatingIncome = pick(row, 'operatingIncome', 'totalOperatingIncomeAsReported');
  const incomeBeforeTax = pick(row, 'pretaxIncome');
  const incomeTaxExpense = pick(row, 'taxProvision');
  const netIncome = pick(row, 'netIncome', 'netIncomeCommonStockholders');
  return {
    ...base(row),
    revenue,
    costOfRevenue: pick(row, 'costOfRevenue', 'reconciledCostOfRevenue'),
    grossProfit,
    grossMargin: div(grossProfit, revenue),
    researchAndDevelopmentExpenses: pick(row, 'researchAndDevelopment'),
    sellingAndMarketingExpenses: pick(row, 'sellingAndMarketingExpense'),
    generalAndAdministrativeExpenses: pick(row, 'generalAndAdministrativeExpense', 'sellingGeneralAndAdministration'),
    operatingExpenses: pick(row, 'operatingExpense'),
    operatingIncome,
    ebit,
    ebitMargin: div(ebit, revenue),
    ebitda: pick(row, 'EBITDA', 'normalizedEBITDA'),
    interestIncome: pick(row, 'interestIncome', 'interestIncomeNonOperating'),
    interestExpense: pick(row, 'interestExpense', 'interestExpenseNonOperating'),
    totalOtherIncomeExpensesNet: pick(row, 'otherIncomeExpense', 'otherNonOperatingIncomeExpenses'),
    incomeBeforeTax,
    incomeTaxExpense,
    taxRate: div(incomeTaxExpense, incomeBeforeTax) ?? pick(row, 'taxRateForCalcs'),
    netIncome,
    netMargin: div(netIncome, revenue),
    eps: pick(row, 'dilutedEPS', 'basicEPS'),
    weightedAverageShsOutDil: pick(row, 'dilutedAverageShares'),
  };
}

function mapBalance(row) {
  const cash = pick(row, 'cashAndCashEquivalents', 'cashFinancial');
  const totalDebt = pick(row, 'totalDebt');
  const goodwill = pick(row, 'goodwill');
  return {
    ...base(row),
    cashAndCashEquivalents: cash,
    netReceivables: pick(row, 'receivables', 'accountsReceivable'),
    inventory: pick(row, 'inventory'),
    otherCurrentAssets: pick(row, 'otherCurrentAssets'),
    totalCurrentAssets: pick(row, 'currentAssets'),
    propertyPlantEquipmentNet: pick(row, 'netPPE'),
    goodwillAndIntangibleAssets: pick(row, 'goodwillAndOtherIntangibleAssets') ?? sum(goodwill, pick(row, 'otherIntangibleAssets')),
    goodwill,
    otherNonCurrentAssets: pick(row, 'otherNonCurrentAssets'),
    totalAssets: pick(row, 'totalAssets'),
    accountPayables: pick(row, 'accountsPayable', 'payables'),
    shortTermDebt: pick(row, 'currentDebt', 'currentDebtAndCapitalLeaseObligation'),
    otherCurrentLiabilities: pick(row, 'otherCurrentLiabilities'),
    totalCurrentLiabilities: pick(row, 'currentLiabilities'),
    longTermDebt: pick(row, 'longTermDebt', 'longTermDebtAndCapitalLeaseObligation'),
    deferredTaxLiabilitiesNonCurrent: pick(row, 'nonCurrentDeferredTaxesLiabilities'),
    otherNonCurrentLiabilities: pick(row, 'otherNonCurrentLiabilities'),
    totalLiabilities: pick(row, 'totalLiabilitiesNetMinorityInterest'),
    commonStock: pick(row, 'commonStock', 'capitalStock'),
    additionalPaidInCapital: pick(row, 'additionalPaidInCapital'),
    retainedEarnings: pick(row, 'retainedEarnings'),
    treasuryStock: pick(row, 'treasuryStock'),
    totalStockholdersEquity: pick(row, 'stockholdersEquity', 'commonStockEquity', 'totalEquityGrossMinorityInterest'),
    totalDebt,
    netDebt: pick(row, 'netDebt') ?? sub(totalDebt, cash),
  };
}

function mapCashFlow(row) {
  const operatingCashFlow = pick(row, 'operatingCashFlow', 'cashFlowFromContinuingOperatingActivities');
  const capitalExpenditure = pick(row, 'capitalExpenditure');
  return {
    ...base(row),
    netIncome: pick(row, 'netIncomeFromContinuingOperations', 'netIncome'),
    depreciationAndAmortization: pick(row, 'depreciationAndAmortization', 'depreciationAmortizationDepletion'),
    stockBasedCompensation: pick(row, 'stockBasedCompensation'),
    changeInWorkingCapital: pick(row, 'changeInWorkingCapital'),
    accountsReceivables: pick(row, 'changesInAccountReceivables', 'changeInReceivables'),
    inventory: pick(row, 'changeInInventory'),
    accountsPayables: pick(row, 'changeInAccountPayable', 'changeInPayable'),
    otherWorkingCapital: pick(row, 'changeInOtherWorkingCapital'),
    operatingCashFlow,
    capitalExpenditure,
    acquisitionsNet: pick(row, 'netBusinessPurchaseAndSale', 'purchaseOfBusiness'),
    otherInvestingActivites: pick(row, 'netOtherInvestingChanges'),
    netCashUsedForInvestingActivites: pick(row, 'investingCashFlow'),
    // Yahoo reports capex as a negative number, so free cash flow is a straight sum.
    freeCashFlow: pick(row, 'freeCashFlow') ?? (operatingCashFlow !== null && capitalExpenditure !== null ? operatingCashFlow + capitalExpenditure : null),
    dividendsPaid: pick(row, 'cashDividendsPaid', 'commonStockDividendPaid'),
    commonStockRepurchased: pick(row, 'repurchaseOfCapitalStock', 'commonStockPayments'),
    debtRepayment: pick(row, 'repaymentOfDebt', 'netIssuancePaymentsOfDebt'),
    netCashUsedProvidedByFinancingActivities: pick(row, 'financingCashFlow'),
    netChangeInCash: pick(row, 'changesInCash'),
    cashAtBeginningOfPeriod: pick(row, 'beginningCashPosition'),
    cashAtEndOfPeriod: pick(row, 'endCashPosition'),
  };
}

// Shape used by the Models and Analysis pages: oldest first, the three statements row-aligned.
function toModelStatements(rows, limit = 5) {
  const picked = selectRows(rows, limit);
  return {
    incomeStatement: picked.map(mapIncome),
    cashFlow: picked.map(mapCashFlow),
    balanceSheet: picked.map(mapBalance),
  };
}

// Shape used by the Financials tab (/api/financials?type=income|balance|cashflow): newest first.
function toLegacyStatements(rows, limit = 8) {
  const m = toModelStatements(rows, limit);
  const income = m.incomeStatement.map((s) => ({
    date: s.date,
    revenue: s.revenue,
    costOfRevenue: s.costOfRevenue,
    grossProfit: s.grossProfit,
    grossProfitRatio: s.grossMargin,
    researchAndDevelopmentExpenses: s.researchAndDevelopmentExpenses,
    operatingExpenses: s.operatingExpenses,
    operatingIncome: s.operatingIncome,
    operatingIncomeRatio: div(s.operatingIncome, s.revenue),
    ebitda: s.ebitda,
    netIncome: s.netIncome,
    netIncomeRatio: s.netMargin,
    eps: s.eps,
    epsDiluted: s.eps,
  }));
  const balance = m.balanceSheet.map((s) => ({
    date: s.date,
    totalAssets: s.totalAssets,
    totalCurrentAssets: s.totalCurrentAssets,
    cashAndCashEquivalents: s.cashAndCashEquivalents,
    totalLiabilities: s.totalLiabilities,
    totalCurrentLiabilities: s.totalCurrentLiabilities,
    totalDebt: s.totalDebt,
    netDebt: s.netDebt,
    totalStockholdersEquity: s.totalStockholdersEquity,
    retainedEarnings: s.retainedEarnings,
  }));
  const cashflow = m.cashFlow.map((s) => ({
    date: s.date,
    operatingCashFlow: s.operatingCashFlow,
    capitalExpenditure: s.capitalExpenditure,
    freeCashFlow: s.freeCashFlow,
    dividendsPaid: s.dividendsPaid,
    netCashUsedForInvestingActivites: s.netCashUsedForInvestingActivites,
    netCashUsedProvidedByFinancingActivities: s.netCashUsedProvidedByFinancingActivities,
  }));
  return { income: income.reverse(), balance: balance.reverse(), cashflow: cashflow.reverse() };
}

// One request returns income, balance sheet and cash flow rows merged by period.
async function fetchStatementRows(symbol, period = 'annual') {
  const { yf } = require('./_yf');
  const annual = period === 'annual';
  const years = annual ? 6 : 3;
  return yf.fundamentalsTimeSeries(symbol, {
    period1: new Date(Date.now() - years * 365 * 864e5),
    type: annual ? 'annual' : 'quarterly',
    module: 'all',
  });
}

async function getModelStatements(symbol) {
  return toModelStatements(await fetchStatementRows(symbol, 'annual'), 5);
}

async function getLegacyStatements(symbol, period = 'annual') {
  return toLegacyStatements(await fetchStatementRows(symbol, period), period === 'annual' ? 5 : 8);
}

module.exports = {
  selectRows,
  toModelStatements,
  toLegacyStatements,
  fetchStatementRows,
  getModelStatements,
  getLegacyStatements,
};
