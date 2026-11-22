const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { MACRO_INSTRUMENTS, INDICES } = require('../api/_marketData');
const { parseSymbol } = require('../api/_validate');

// The market snapshot, the daily brief and the macro screens all read this list. Its headline rows are the index
// levels themselves, never the SPY/QQQ/DIA/IWM funds: a fund price is about a tenth of the index and reads as wrong.
const HEADLINE = [
  ['^GSPC', 'S&P 500'],
  ['^NDX', 'NASDAQ 100'],
  ['^DJI', 'Dow Jones'],
  ['^RUT', 'Russell 2000'],
];

test('the macro list leads with the four headline indices as real index levels', () => {
  assert.deepEqual(MACRO_INSTRUMENTS.slice(0, 4).map((i) => [i.symbol, i.label]), HEADLINE);
});

test('the macro list holds no ETF stand-ins for the indices', () => {
  const symbols = MACRO_INSTRUMENTS.map((i) => i.symbol);
  for (const etf of ['SPY', 'QQQ', 'DIA', 'IWM']) assert.ok(!symbols.includes(etf), `${etf} should not be in the macro list`);
});

test('every macro symbol is one the API accepts, and each symbol and label appears once', () => {
  for (const { symbol } of MACRO_INSTRUMENTS) assert.equal(parseSymbol(symbol), symbol, `${symbol} must pass the API symbol check`);
  assert.equal(new Set(MACRO_INSTRUMENTS.map((i) => i.symbol)).size, MACRO_INSTRUMENTS.length, 'duplicate symbol');
  assert.equal(new Set(MACRO_INSTRUMENTS.map((i) => i.label)).size, MACRO_INSTRUMENTS.length, 'duplicate label');
});

test('the headline indices are named the same in the global-indices list, so each name is defined once', () => {
  for (const [symbol, label] of HEADLINE) {
    const idx = INDICES.find((i) => i.symbol === symbol);
    assert.ok(idx, `${symbol} missing from INDICES`);
    assert.equal(idx.name, label);
  }
});

test('the frontend headline list (src/constants/marketIndices.js) names the same four indices', () => {
  const file = path.join(__dirname, '..', 'src', 'constants', 'marketIndices.js');
  const src = fs.readFileSync(file, 'utf8');
  const pairs = [...src.matchAll(/symbol:\s*'([^']+)',\s*label:\s*'([^']+)'/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(pairs, HEADLINE);
});
