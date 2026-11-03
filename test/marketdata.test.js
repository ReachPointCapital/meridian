const { test } = require('node:test');
const assert = require('node:assert/strict');
const { COMMODITIES, FOREX_PAIRS, INDICES, buildCommodities, buildForex, buildIndices } = require('../api/_marketData');

const quote = (price, extra = {}) => ({
  regularMarketPrice: price, regularMarketChange: 1.5, regularMarketChangePercent: 0.75, regularMarketPreviousClose: price - 1.5, ...extra,
});
const mapOf = (entries) => new Map(Object.entries(entries));

test('the symbol lists are unique so one batched request covers each of them', () => {
  for (const list of [COMMODITIES, FOREX_PAIRS, INDICES]) {
    assert.equal(new Set(list.map((x) => x.symbol)).size, list.length);
  }
});

test('commodities keep their category and order, and drop what Yahoo did not price', () => {
  const rows = buildCommodities(mapOf({ 'CL=F': quote(80), 'GC=F': quote(2000), 'SI=F': { symbol: 'SI=F' } }));
  assert.deepEqual(rows.map((r) => r.symbol), ['CL=F', 'GC=F']);
  assert.deepEqual(rows[0], {
    symbol: 'CL=F', name: 'Crude Oil WTI', category: 'Energy', price: 80, change: 1.5, changePercent: 0.75, previousClose: 78.5,
  });
  assert.deepEqual(buildCommodities(mapOf({})), []);
});

test('forex keeps every pair, with nulls where there is no rate, and both change field names the screens use', () => {
  const rows = buildForex(mapOf({ 'EURUSD=X': quote(1.08) }));
  assert.equal(rows.length, FOREX_PAIRS.length);
  assert.deepEqual(rows[0], {
    pair: 'EUR/USD', symbol: 'EURUSD=X', ticker: 'EUR/USD', rate: 1.08, price: 1.08, change: 1.5, changePercent: 0.75, changesPercentage: 0.75,
  });
  const missing = rows.find((r) => r.symbol === 'GBPUSD=X');
  assert.deepEqual([missing.rate, missing.price, missing.change, missing.changePercent, missing.changesPercentage], [null, null, null, null, null]);
});

test('global indices keep every index; unpriced ones read as closed', () => {
  const rows = buildIndices(mapOf({ '^GSPC': quote(5000, { marketState: 'REGULAR' }) }));
  assert.equal(rows.length, INDICES.length);
  assert.deepEqual(rows[0], {
    symbol: '^GSPC', name: 'S&P 500', region: 'US', price: 5000, change: 1.5, changePercent: 0.75, previousClose: 4998.5, marketState: 'REGULAR',
  });
  const missing = rows.find((r) => r.symbol === '^FTSE');
  assert.equal(missing.price, null);
  assert.equal(missing.marketState, 'CLOSED');
});
