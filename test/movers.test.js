const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseAlphaMovers } = require('../api/_movers');

const row = (ticker, price, pct, extra = {}) => ({
  ticker, price: String(price), change_amount: '1.5', change_percentage: `${pct}%`, volume: '123456', ...extra,
});
const payload = {
  top_gainers: [row('GOOD', 12.5, 20.1), row('PENNY', 0.42, 300), row('ABCDW', 3, 50), row('BRK-B', 450, 1.2)],
  top_losers: [row('DROP', 8, -30)],
  most_actively_traded: [row('BUSY', 20, 0.4)],
};

test('movers are mapped to the shape the screens read', () => {
  assert.deepEqual(parseAlphaMovers(payload, 'top_losers'), [
    { symbol: 'DROP', name: 'DROP', price: 8, change: 1.5, changesPercentage: -30, volume: 123456 },
  ]);
});

test('sub-dollar stocks, warrants and other non-common tickers are left out', () => {
  assert.deepEqual(parseAlphaMovers(payload, 'top_gainers').map((r) => r.symbol), ['GOOD', 'BRK-B']);
});

test('the list is capped at 20 rows', () => {
  const letters = (i) => String.fromCharCode(65 + (i % 26), 65 + Math.floor(i / 26)); // AA, BA, CA, ...
  const many = { top_gainers: Array.from({ length: 40 }, (_, i) => row(letters(i), 10, 5)) };
  assert.equal(parseAlphaMovers(many, 'top_gainers').length, 20);
});

test('a missing list, an error payload or junk gives an empty list', () => {
  assert.deepEqual(parseAlphaMovers({}, 'top_gainers'), []);
  assert.deepEqual(parseAlphaMovers({ Note: 'rate limit' }, 'top_gainers'), []);
  assert.deepEqual(parseAlphaMovers(null, 'top_gainers'), []);
  assert.deepEqual(parseAlphaMovers({ top_gainers: [null, { ticker: 'X' }] }, 'top_gainers'), []);
});
