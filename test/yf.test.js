// Run with: npm run test:api
const test = require('node:test');
const assert = require('node:assert/strict');
const { tolerant, createTolerantClient } = require('../api/_yf');

// What yahoo-finance2 throws when Yahoo changes a response shape: the error still carries the parsed response.
const drift = (result) => Object.assign(new Error('Failed Yahoo Schema validation'), {
  name: 'FailedYahooValidationError',
  result,
  errors: [{ instancePath: '/quotes/0', message: 'should match some schema in oneOf' }],
});

test('tolerant returns the value when the call succeeds', async () => {
  assert.deepEqual(await tolerant(async () => ({ ok: 1 })), { ok: 1 });
});

test('tolerant returns the parsed response when only schema validation failed', async (t) => {
  t.mock.method(console, 'warn', () => {});
  const out = await tolerant(async () => { throw drift({ quotes: [{ symbol: 'AAPL' }] }); }, 'screener');
  assert.deepEqual(out, { quotes: [{ symbol: 'AAPL' }] });
  assert.equal(console.warn.mock.callCount(), 1);
});

test('tolerant rethrows a validation error that carries no response', async () => {
  await assert.rejects(() => tolerant(async () => { throw drift(undefined); }), { name: 'FailedYahooValidationError' });
});

test('tolerant rethrows every other error', async () => {
  await assert.rejects(() => tolerant(async () => { throw new Error('network down'); }), /network down/);
});

test('tolerant also catches errors thrown before a promise is returned', async () => {
  await assert.rejects(() => tolerant(() => { throw new Error('bad options'); }), /bad options/);
});

test('a wrapped client protects existing call sites without changing them', async (t) => {
  t.mock.method(console, 'warn', () => {});
  const fake = {
    search: async () => { throw drift({ quotes: [{ symbol: 'AAPL' }], news: [] }); },
    quote: async (s) => ({ symbol: s }),
    someNumber: 42,
  };
  const client = createTolerantClient(fake);
  assert.deepEqual((await client.search('apple')).quotes, [{ symbol: 'AAPL' }]);
  assert.deepEqual(await client.quote('MSFT'), { symbol: 'MSFT' });
  assert.equal(client.someNumber, 42);
});
