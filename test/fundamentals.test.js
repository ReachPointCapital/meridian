// Run with: npm run test:api
// Fixtures are real Yahoo fundamentalsTimeSeries rows (annual, module "all"), saved as JSON like they arrive over the wire.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  toModelStatements,
  toLegacyStatements,
  selectRows,
} = require('../api/_fundamentals');

const aapl = require('./fixtures/fts-aapl-annual.json');
const jpm = require('./fixtures/fts-jpm-annual.json');

// Every key the Models / Analysis pages read from the statements payload (see src/pages/Models.js, AnalysisTab.jsx).
const INCOME_KEYS = [
  'date', 'year', 'revenue', 'costOfRevenue', 'grossProfit', 'grossMargin', 'researchAndDevelopmentExpenses',
  'sellingAndMarketingExpenses', 'generalAndAdministrativeExpenses', 'operatingExpenses', 'ebit', 'ebitMargin', 'ebitda',
  'interestIncome', 'interestExpense', 'totalOtherIncomeExpensesNet', 'incomeBeforeTax', 'incomeTaxExpense', 'taxRate',
  'netIncome', 'netMargin', 'eps', 'weightedAverageShsOutDil',
];
const BALANCE_KEYS = [
  'date', 'year', 'cashAndCashEquivalents', 'netReceivables', 'inventory', 'otherCurrentAssets', 'totalCurrentAssets',
  'propertyPlantEquipmentNet', 'goodwillAndIntangibleAssets', 'goodwill', 'otherNonCurrentAssets', 'totalAssets',
  'accountPayables', 'shortTermDebt', 'otherCurrentLiabilities', 'totalCurrentLiabilities', 'longTermDebt',
  'deferredTaxLiabilitiesNonCurrent', 'otherNonCurrentLiabilities', 'totalLiabilities', 'commonStock',
  'additionalPaidInCapital', 'retainedEarnings', 'treasuryStock', 'totalStockholdersEquity', 'totalDebt',
];
const CASHFLOW_KEYS = [
  'date', 'year', 'netIncome', 'depreciationAndAmortization', 'stockBasedCompensation', 'changeInWorkingCapital',
  'accountsReceivables', 'inventory', 'accountsPayables', 'otherWorkingCapital', 'operatingCashFlow',
  'capitalExpenditure', 'acquisitionsNet', 'otherInvestingActivites', 'freeCashFlow', 'dividendsPaid',
  'commonStockRepurchased', 'debtRepayment', 'netCashUsedProvidedByFinancingActivities', 'netChangeInCash',
  'cashAtBeginningOfPeriod', 'cashAtEndOfPeriod',
];

test('model statements keep the key contract the Models page reads', () => {
  const s = toModelStatements(aapl);
  for (const k of INCOME_KEYS) assert.ok(k in s.incomeStatement[0], `income missing ${k}`);
  for (const k of BALANCE_KEYS) assert.ok(k in s.balanceSheet[0], `balance missing ${k}`);
  for (const k of CASHFLOW_KEYS) assert.ok(k in s.cashFlow[0], `cashflow missing ${k}`);
});

test('model statements are oldest-first and carry a calendar year from the UTC date', () => {
  const s = toModelStatements(aapl);
  assert.equal(s.incomeStatement.length, 2);
  assert.ok(s.incomeStatement[0].year < s.incomeStatement[1].year);
  assert.equal(s.incomeStatement[1].year, 2025);
  assert.equal(s.incomeStatement[1].date, '2025-09-30T00:00:00.000Z');
});

test('AAPL FY2025 income statement is populated (the old Yahoo modules returned zeros here)', () => {
  const inc = toModelStatements(aapl).incomeStatement[1];
  assert.equal(inc.revenue, 416161000000);
  assert.equal(inc.grossProfit, 195201000000);
  assert.ok(inc.costOfRevenue > 200e9);
  assert.equal(inc.ebitda, 144748000000);
  assert.equal(inc.ebit, 133050000000);
  assert.equal(inc.netIncome, 112010000000);
  assert.ok(Math.abs(inc.grossMargin - 195201000000 / 416161000000) < 1e-9);
  assert.ok(Math.abs(inc.netMargin - 112010000000 / 416161000000) < 1e-9);
  assert.ok(inc.eps > 5 && inc.eps < 12);
  assert.ok(inc.weightedAverageShsOutDil > 1e10);
});

test('AAPL FY2025 balance sheet is populated so EV bridges are not equal to equity value', () => {
  const bs = toModelStatements(aapl).balanceSheet[1];
  assert.equal(bs.totalAssets, 359241000000);
  assert.equal(bs.cashAndCashEquivalents, 35934000000);
  assert.equal(bs.totalDebt, 98657000000);
  assert.ok(bs.totalStockholdersEquity > 0);
  assert.ok(bs.totalLiabilities > 0);
  assert.ok(bs.netReceivables > 0);
  assert.ok(bs.accountPayables > 0);
});

test('AAPL FY2025 cash flow keeps Yahoo sign convention (capex negative) and free cash flow', () => {
  const cf = toModelStatements(aapl).cashFlow[1];
  assert.equal(cf.operatingCashFlow, 111482000000);
  assert.equal(cf.capitalExpenditure, -12715000000);
  assert.equal(cf.freeCashFlow, 98767000000);
  assert.ok(cf.depreciationAndAmortization > 0);
});

test('missing fields are null, never a made-up 0 (a bank has no gross profit or EBITDA)', () => {
  const inc = toModelStatements(jpm).incomeStatement[1];
  assert.equal(inc.grossProfit, null);
  assert.equal(inc.grossMargin, null);
  assert.equal(inc.ebitda, null);
  assert.equal(typeof inc.revenue, 'number');
  assert.equal(typeof inc.netIncome, 'number');
  assert.equal(inc.year, 2025);
});

test('free cash flow is derived from operating cash flow and capex when Yahoo omits it', () => {
  const rows = [{ date: '2025-12-31T00:00:00.000Z', operatingCashFlow: 100, capitalExpenditure: -30 }];
  assert.equal(toModelStatements(rows).cashFlow[0].freeCashFlow, 70);
});

test('legacy statements (Financials tab) are newest-first with the keys that tab reads', () => {
  const l = toLegacyStatements(aapl);
  assert.equal(l.income[0].date.slice(0, 4), '2025');
  assert.equal(l.income[1].date.slice(0, 4), '2024');
  for (const k of ['revenue', 'costOfRevenue', 'grossProfit', 'grossProfitRatio', 'researchAndDevelopmentExpenses',
    'operatingExpenses', 'operatingIncome', 'operatingIncomeRatio', 'ebitda', 'netIncome', 'netIncomeRatio', 'eps', 'epsDiluted']) {
    assert.ok(k in l.income[0], `legacy income missing ${k}`);
  }
  for (const k of ['totalAssets', 'totalCurrentAssets', 'cashAndCashEquivalents', 'totalLiabilities',
    'totalCurrentLiabilities', 'totalDebt', 'netDebt', 'totalStockholdersEquity', 'retainedEarnings']) {
    assert.ok(k in l.balance[0], `legacy balance missing ${k}`);
  }
  for (const k of ['operatingCashFlow', 'capitalExpenditure', 'freeCashFlow', 'dividendsPaid',
    'netCashUsedForInvestingActivites', 'netCashUsedProvidedByFinancingActivities']) {
    assert.ok(k in l.cashflow[0], `legacy cashflow missing ${k}`);
  }
  assert.ok(l.income[0].grossProfitRatio > 0.4 && l.income[0].grossProfitRatio < 0.6);
  assert.equal(l.income[0].operatingIncome, 133050000000);
});

test('accepts Date objects as well as ISO strings and always emits an ISO string', () => {
  const rows = [{ date: new Date('2024-06-30T00:00:00.000Z'), totalRevenue: 10, netIncome: 1 }];
  const s = toModelStatements(rows);
  assert.equal(s.incomeStatement[0].date, '2024-06-30T00:00:00.000Z');
  assert.equal(s.incomeStatement[0].year, 2024);
});

test('selectRows drops empty rows, sorts oldest-first and keeps the newest N', () => {
  const rows = [
    { date: '2025-03-31T00:00:00.000Z', totalRevenue: 3 },
    { date: '2023-03-31T00:00:00.000Z', totalRevenue: 1 },
    { date: '2024-03-31T00:00:00.000Z' }, // reported nothing
    { date: '2024-09-30T00:00:00.000Z', totalAssets: 2 },
  ];
  const out = selectRows(rows, 2);
  assert.deepEqual(out.map((r) => r.date.slice(0, 10)), ['2024-09-30', '2025-03-31']);
});

test('selectRows tolerates junk input', () => {
  assert.deepEqual(selectRows(undefined, 5), []);
  assert.deepEqual(selectRows(null, 5), []);
  assert.deepEqual(selectRows([null, 7, {}], 5), []);
});
