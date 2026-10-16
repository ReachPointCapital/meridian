const { test } = require('node:test');
const assert = require('node:assert/strict');
const { HEATMAP_SYMBOLS, buildHeatmap, fetchHeatmap } = require('../api/_heatmap');
const { parseSymbol } = require('../api/_validate');

test('the ticker list has no duplicates and every entry is a valid symbol', () => {
  assert.equal(new Set(HEATMAP_SYMBOLS).size, HEATMAP_SYMBOLS.length);
  for (const s of HEATMAP_SYMBOLS) assert.equal(parseSymbol(s), s, s);
  assert.ok(HEATMAP_SYMBOLS.length >= 250, `only ${HEATMAP_SYMBOLS.length}`);
});

test('delisted or renamed tickers are gone and their successors are in', () => {
  for (const dead of ['MMC', 'BK', 'RE', 'ABC', 'PKI', 'HOLX', 'CTLT', 'SPR', 'DFS', 'CMA']) {
    assert.ok(!HEATMAP_SYMBOLS.includes(dead), `${dead} should be removed`);
  }
  for (const live of ['MRSH', 'BNY', 'EG', 'COR', 'RVTY']) {
    assert.ok(HEATMAP_SYMBOLS.includes(live), `${live} should be present`);
  }
});

test('foreign ADRs and companies that are not in the S&P 500 are not on the S&P 500 heatmap', () => {
  for (const s of ['RIVN', 'LCID', 'NIO', 'LI', 'XPEV', 'TM', 'W', 'CHWY']) {
    assert.ok(!HEATMAP_SYMBOLS.includes(s), `${s} should be removed`);
  }
});

test('buildHeatmap keeps usable quotes, fills a missing market cap, and sorts by size', () => {
  const rows = buildHeatmap([
    { symbol: 'SMALL', longName: 'Small Co', regularMarketPrice: 10, regularMarketChangePercent: 1.5, marketCap: 1e9 },
    { symbol: 'BIG', shortName: 'Big Co', regularMarketPrice: 200, regularMarketChangePercent: -0.4, marketCap: 5e11 },
    { symbol: 'NOCAP', regularMarketPrice: 5, regularMarketChangePercent: 0.1 },
    { symbol: 'NOPRICE', regularMarketChangePercent: 1 },
    { symbol: 'NOCHANGE', regularMarketPrice: 5 },
    null,
  ]);
  assert.deepEqual(rows.map((r) => r.symbol), ['BIG', 'SMALL', 'NOCAP']);
  assert.deepEqual(rows[0], { symbol: 'BIG', name: 'Big Co', marketCap: 5e11, price: 200, changePercent: -0.4 });
  assert.equal(rows[2].marketCap, 0);
  assert.equal(rows[2].name, 'NOCAP');
});

test('fetchHeatmap needs a handful of requests, not one per stock', async () => {
  const calls = [];
  const client = {
    async quote(symbols) {
      calls.push(symbols.length);
      return symbols.map((s) => ({ symbol: s, regularMarketPrice: 10, regularMarketChangePercent: 1, marketCap: 1e9 }));
    },
  };
  const rows = await fetchHeatmap({ client });
  assert.ok(calls.length <= 4, `made ${calls.length} requests`);
  assert.equal(rows.length, HEATMAP_SYMBOLS.length);
});
