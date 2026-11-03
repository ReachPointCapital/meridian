const test = require('node:test');
const assert = require('node:assert/strict');
const { parseSymbol, parseSymbols, parseDate, normalizeQuery } = require('../api/_validate');

test('parseSymbol accepts every kind of instrument the app uses, upper-cased', () => {
  for (const [input, expected] of [
    ['AAPL', 'AAPL'], ['aapl', 'AAPL'], [' msft ', 'MSFT'], ['BRK-B', 'BRK-B'], ['^GSPC', '^GSPC'],
    ['EURUSD=X', 'EURUSD=X'], ['ES=F', 'ES=F'], ['2YY=F', '2YY=F'], ['000001.SS', '000001.SS'], ['BTC-USD', 'BTC-USD'],
  ]) {
    assert.equal(parseSymbol(input), expected, input);
  }
});

test('parseSymbol rejects anything that is not a ticker', () => {
  for (const bad of ['', '   ', null, undefined, 'A B', 'AAPL;DROP', '../etc/passwd', '<script>', "AAPL'", 'AAPL\n', 'a'.repeat(21), 'AAPL&apikey=x', ['AAPL'], 42, {}]) {
    assert.equal(parseSymbol(bad), null, JSON.stringify(bad));
  }
});

test('parseSymbols splits, validates, de-duplicates and caps the list', () => {
  assert.deepEqual(parseSymbols('AAPL,msft, ^VIX,AAPL'), ['AAPL', 'MSFT', '^VIX']);
  assert.equal(parseSymbols('AAPL,bad symbol'), null);
  assert.equal(parseSymbols(''), null);
  const list = (n) => Array.from({ length: n }, (_, i) => `T${i}`).join(',');
  assert.equal(parseSymbols(list(100)).length, 100); // a large watchlist still loads (one Yahoo batch)
  assert.equal(parseSymbols(list(101)), null);
  assert.equal(parseSymbols(list(51), 60).length, 51);
});

test('parseDate accepts real calendar dates only', () => {
  assert.equal(parseDate('2026-10-28'), '2026-10-28');
  for (const bad of ['2026-13-01', '2026-02-30', 'abc', '2026-1-1', '', null, '2026-10-28T00:00:00Z', '2026-10-28&x=1']) {
    assert.equal(parseDate(bad), null, String(bad));
  }
});

test('normalizeQuery upper-cases symbols and passes unknown keys through untouched', () => {
  const r = normalizeQuery({ type: 'quote', symbol: 'aapl', extra: 'x' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.query, { type: 'quote', symbol: 'AAPL', extra: 'x' });
});

test('normalizeQuery allows a symbol list only for type=quote', () => {
  assert.equal(normalizeQuery({ type: 'quote', symbol: 'AAPL,msft' }).query.symbol, 'AAPL,MSFT');
  assert.equal(normalizeQuery({ type: 'profile', symbol: 'AAPL,MSFT' }).ok, false);
  assert.equal(normalizeQuery({ symbol: 'AAPL,MSFT' }).ok, false);
});

test('normalizeQuery rejects bad values with a 400 and a safe message', () => {
  for (const query of [
    { symbol: 'AAPL;x' },
    { symbol: ['AAPL', 'MSFT'] },
    { timeframe: '10Y' },
    { period: 'weekly' },
    { type: 'quote; drop' },
    { from: '2026-02-30' },
    { from: '2026-10-01', to: '2026-09-01' },
    { from: '2024-01-01', to: '2026-10-01' },
    { url: 'x'.repeat(3000) },
  ]) {
    const r = normalizeQuery(query);
    assert.equal(r.ok, false, JSON.stringify(query));
    assert.equal(r.status, 400);
    assert.match(r.error, /^Invalid /);
  }
});

test('normalizeQuery accepts the values the frontend sends', () => {
  const r = normalizeQuery({ type: 'earnings', from: '2026-10-16', to: '2026-10-30' });
  assert.equal(r.ok, true);
  assert.equal(normalizeQuery({ symbol: 'AAPL', timeframe: '1D' }).ok, true);
  assert.equal(normalizeQuery({ symbol: 'AAPL', type: 'income', period: 'quarterly' }).ok, true);
});

// Every `type=` value the frontend sends (src/services/api.js and the pages). One of them, m2, has a digit.
const FRONTEND_TYPES = ['actives', 'all', 'analysis', 'analyst', 'article', 'calendar', 'centralbanks', 'commodities', 'crypto',
  'dailybrief', 'earnings', 'earningshistory', 'feargreed', 'forex', 'gainers', 'globalindices', 'heatmap', 'ipos', 'losers',
  'm2', 'macro', 'news', 'profile', 'quote', 'releases', 'sectors', 'shorts', 'yields'];

test('normalizeQuery accepts every type the frontend sends', () => {
  for (const type of FRONTEND_TYPES) assert.equal(normalizeQuery({ type }).ok, true, type);
});

test('normalizeQuery still rejects types that are not plain lower-case words', () => {
  for (const type of ['M2', '2m', 'm 2', 'm2;drop', '', '../x', 'a'.repeat(21), ['m2'], undefined]) {
    assert.equal(normalizeQuery({ type }).ok, false, String(type));
  }
});

test('normalizeQuery trims search text, strips control characters and caps its length', () => {
  assert.equal(normalizeQuery({ q: '  apple\u0000 inc  ' }).query.q, 'apple inc');
  assert.equal(normalizeQuery({ q: 'x'.repeat(200) }).query.q.length, 60);
});
