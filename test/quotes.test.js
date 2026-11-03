const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mapQuote, quotesInOrder, getQuotes, getQuoteMap } = require('../api/_yahoo');

const raw = {
  symbol: 'AAPL', longName: 'Apple Inc.', regularMarketPrice: 342, regularMarketOpen: 346.95, regularMarketDayHigh: 347.85,
  regularMarketDayLow: 341.6, regularMarketVolume: 39605715, regularMarketPreviousClose: 342.96, regularMarketChange: -0.96,
  regularMarketChangePercent: -0.28, marketCap: 4.99e12, trailingPE: 39.2, forwardPE: 35.7, epsTrailingTwelveMonths: 8.72,
  fiftyTwoWeekHigh: 348.15, fiftyTwoWeekLow: 243.42, averageDailyVolume3Month: 44504567, beta: 1.07, dividendYield: 0.32,
  priceToBook: 46.47, fullExchangeName: 'NasdaqGS', currency: 'USD', marketState: 'PRE', fiftyDayAverage: 325.08, twoHundredDayAverage: 292.11,
};

test('mapQuote produces the fields the frontend reads', () => {
  const q = mapQuote(raw);
  assert.equal(q.symbol, 'AAPL');
  assert.equal(q.name, 'Apple Inc.');
  assert.equal(q.price, 342);
  assert.equal(q.changesPercentage, -0.28);
  assert.equal(q.marketCap, 4.99e12);
  assert.equal(q.pe, 39.2);
  assert.equal(q.yearHigh, 348.15);
  assert.equal(q.priceAvg200, 292.11);
  assert.equal(q.marketState, 'PRE');
  assert.equal(q.source, 'yahoo');
});

test('dividendYield is a percentage (0.32 means 0.32%) and stays null when Yahoo has none', () => {
  assert.equal(mapQuote(raw).dividendYield, 0.32);
  assert.equal(mapQuote({ ...raw, dividendYield: undefined }).dividendYield, null);
});

test('quotesInOrder returns results in the order requested and drops what is missing', () => {
  const results = [{ symbol: 'A' }, { symbol: 'B' }];
  assert.deepEqual(quotesInOrder(['B', 'zzz', 'a'], results).map((q) => q.symbol), ['B', 'A']);
  assert.deepEqual(quotesInOrder([], results), []);
});

// A fake client: quote(array) answers for every symbol except those listed as missing.
function fakeClient({ missing = [], failOnCall } = {}) {
  const calls = [];
  return {
    calls,
    async quote(symbols) {
      calls.push(symbols);
      if (failOnCall === calls.length) throw new Error('boom');
      return symbols.filter((s) => !missing.includes(s)).map((s) => ({ symbol: s, regularMarketPrice: 1 }));
    },
  };
}
const symbols = (n) => Array.from({ length: n }, (_, i) => `T${i}`);

test('getQuotes batches many symbols into a few requests instead of one per symbol', async () => {
  const client = fakeClient();
  const out = await getQuotes(symbols(250), { client, chunk: 100 });
  assert.equal(client.calls.length, 3);
  assert.deepEqual(client.calls.map((c) => c.length), [100, 100, 50]);
  assert.equal(out.length, 250);
});

test('getQuotes keeps the other batches when one fails', async (t) => {
  t.mock.method(console, 'warn', () => {});
  const client = fakeClient({ failOnCall: 2 });
  const out = await getQuotes(symbols(250), { client, chunk: 100 });
  assert.equal(out.length, 150);
  assert.equal(console.warn.mock.callCount(), 1);
});

test('getQuotes throws when every batch fails, so callers can tell an outage from an unknown symbol', async (t) => {
  t.mock.method(console, 'warn', () => {});
  const client = { async quote() { throw new Error('yahoo is down'); } };
  await assert.rejects(getQuotes(symbols(250), { client, chunk: 100 }), /yahoo is down/);
  assert.deepEqual(await getQuotes([], { client }), []);
});

test('getQuoteMap indexes quotes by symbol; unknown symbols are simply absent', async () => {
  const client = fakeClient({ missing: ['T1'] });
  const map = await getQuoteMap(['T0', 'T1', 'T2'], { client });
  assert.deepEqual([...map.keys()].sort(), ['T0', 'T2']);
  assert.equal(map.get('T0').regularMarketPrice, 1);
});
