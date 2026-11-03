// The date logic must not depend on the server's timezone, so these tests run in one far from UTC (set before any
// date is created; each test file runs in its own process).
process.env.TZ = 'America/Los_Angeles';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { recurringEstimates, fomcEvents, earningsSymbols, mapFmpEarnings, parseEdgarName, buildIpoRows } = require('../api/_calendar');

const on = (events, name) => events.filter((e) => e.event === name).map((e) => e.date);

test('this file really runs outside UTC, so the tests below mean something', () => {
  assert.notEqual(new Date(2026, 0, 1).getTimezoneOffset(), 0);
});

test('weekly jobless claims fall on Thursdays whatever timezone the server runs in', () => {
  const events = recurringEstimates('2026-10-16', '2026-10-30');
  assert.deepEqual(on(events, 'Initial Jobless Claims (est.)'), ['2026-10-22', '2026-10-29']);
});

test('the jobs report is the first Friday of the month', () => {
  assert.deepEqual(on(recurringEstimates('2026-11-01', '2026-11-10'), 'Nonfarm Payrolls (est.)'), ['2026-11-06']);
});

test('fixed-day events that land on a weekend move to the next Monday', () => {
  // 28 Nov 2026 is a Saturday
  assert.deepEqual(on(recurringEstimates('2026-11-25', '2026-12-02'), 'GDP Estimate (est.)'), ['2026-11-30']);
});

test('every estimate is labelled as one, and the list is sorted', () => {
  const events = recurringEstimates('2026-10-16', '2026-11-30');
  assert.ok(events.length > 5);
  for (const e of events) {
    assert.equal(e.estimated, true);
    assert.equal(e.country, 'US');
    assert.match(e.event, /\(est\.\)$/);
    assert.equal(e.estimate, null);
    assert.equal(e.actual, null);
  }
  const dates = events.map((e) => e.date);
  assert.deepEqual(dates, [...dates].sort());
});

test('events outside the window are not returned', () => {
  const events = recurringEstimates('2026-10-16', '2026-10-18');
  assert.ok(events.every((e) => e.date >= '2026-10-16' && e.date <= '2026-10-18'));
});

const fmp = [
  { symbol: 'ABBV', date: '2026-10-30', epsActual: null, epsEstimated: 3.74, revenueActual: null, revenueEstimated: 1.2e10 },
  { symbol: 'AAPL', date: '2026-10-29', epsActual: null, epsEstimated: 1.9, revenueActual: null, revenueEstimated: 1e11 },
  { symbol: 'MSFT', date: '2026-10-29', epsActual: 4.1, epsEstimated: 3.9, revenueActual: 7e10, revenueEstimated: 6.9e10 },
  { symbol: 'OBSC', date: '2026-10-29', epsActual: null, epsEstimated: 0.1 },
  { symbol: 'AAPL', date: '2026-10-29', epsActual: null, epsEstimated: 1.9 },
  { symbol: '', date: '2026-10-29' },
];
const names = new Map([
  ['ABBV', { name: 'AbbVie Inc.', marketCap: 3.5e11 }],
  ['AAPL', { name: 'Apple Inc.', marketCap: 4.99e12 }],
  ['MSFT', { name: 'Microsoft Corporation', marketCap: 4.2e12 }],
]);

test('earnings rows get names, EPS fields the UI reads, and a useful order', () => {
  const rows = mapFmpEarnings(fmp, names);
  assert.deepEqual(rows.map((r) => `${r.date} ${r.symbol}`), ['2026-10-29 AAPL', '2026-10-29 MSFT', '2026-10-29 OBSC', '2026-10-30 ABBV']);
  const msft = rows.find((r) => r.symbol === 'MSFT');
  assert.equal(msft.name, 'Microsoft Corporation');
  assert.equal(msft.epsEstimate, 3.9);
  assert.equal(msft.epsActual, 4.1);
  assert.equal(msft.revenueActual, 7e10);
  assert.equal(msft.time, 'unknown');
  assert.equal(rows.find((r) => r.symbol === 'OBSC').name, 'OBSC');
});

test('earnings rows are limited to a sensible number', () => {
  const many = Array.from({ length: 700 }, (_, i) => ({ symbol: `T${i}`, date: '2026-10-29', epsEstimated: 1 }));
  assert.equal(mapFmpEarnings(many, new Map()).length, 400);
  assert.deepEqual(mapFmpEarnings(null, names), []);
});

test('parseEdgarName splits company, ticker and drops the CIK number', () => {
  assert.deepEqual(parseEdgarName('iPower Inc.  (IPW)  (CIK 0001830072)'), { company: 'iPower Inc.', symbol: 'IPW' });
  assert.deepEqual(parseEdgarName('Cashlin (CIK 0002155673)'), { company: 'Cashlin', symbol: '' });
  assert.deepEqual(parseEdgarName('AMERICAN BATTERY TECHNOLOGY CO  (ABAT, ABATW)  (CIK 0001576873)'), { company: 'AMERICAN BATTERY TECHNOLOGY CO', symbol: 'ABAT' });
  assert.deepEqual(parseEdgarName(undefined), { company: 'Unknown', symbol: '' });
});

test('IPO rows combine priced offerings and filings, newest first, one per company', () => {
  const hit = (name, date) => ({ _source: { display_names: [name], file_date: date } });
  const rows = buildIpoRows({
    prospectus: [hit('Iambic Therapeutics, Inc.  (IAM)  (CIK 0001997038)', '2026-10-14')],
    s1: [
      hit('iPower Inc.  (IPW)  (CIK 0001830072)', '2026-10-15'),
      hit('Iambic Therapeutics, Inc.  (IAM)  (CIK 0001997038)', '2026-10-01'),
    ],
  });
  assert.deepEqual(rows.map((r) => r.company), ['iPower Inc.', 'Iambic Therapeutics, Inc.']);
  assert.equal(rows[0].priceRange, 'Filed (S-1)');
  assert.equal(rows[1].priceRange, 'Priced');
  assert.equal(rows[1].symbol, 'IAM');
  assert.equal(rows[0].exchange, '');
});

test('FOMC decision days come from the published schedule and are not marked as estimates', () => {
  const events = fomcEvents('2026-10-16', '2026-11-30');
  assert.deepEqual(events, [{
    event: 'FOMC Rate Decision', date: '2026-10-28', country: 'US', impact: 'High',
    estimate: null, previous: null, actual: null, estimated: false,
  }]);
  assert.deepEqual(fomcEvents('2026-10-29', '2026-12-08'), []);
  assert.deepEqual(fomcEvents('2026-10-28', '2026-10-28').map((e) => e.date), ['2026-10-28']);
});

test('earningsSymbols picks the covered US names, biggest expected revenue first, without duplicates', () => {
  const rows = [
    { symbol: 'SMALL', date: '2026-10-29', epsEstimated: 0.1, revenueEstimated: 1e6 },
    { symbol: 'BIG', date: '2026-10-29', epsEstimated: 1, revenueEstimated: 5e10 },
    { symbol: 'BIG', date: '2026-10-29', epsEstimated: 1, revenueEstimated: 5e10 },
    { symbol: 'BRK-B', date: '2026-10-30', epsEstimated: 5, revenueEstimated: 9e10 },
    { symbol: '0700.HK', date: '2026-10-30', epsEstimated: 1, revenueEstimated: 9e11 },
    { symbol: 'NOEST', date: '2026-10-30', epsEstimated: null, revenueEstimated: null },
    { symbol: 'NOREV', date: '2026-10-30', epsEstimated: 0.5 },
    { symbol: '', date: '2026-10-30', epsEstimated: 1 },
    null,
  ];
  assert.deepEqual(earningsSymbols(rows, 10), ['BRK-B', 'BIG', 'SMALL', 'NOREV']);
  assert.deepEqual(earningsSymbols(rows, 2), ['BRK-B', 'BIG']);
  assert.deepEqual(earningsSymbols(null, 10), []);
});
