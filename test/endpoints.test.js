// Every serverless function, called the way Vercel calls it, with the network switched off.
// This is what proves each endpoint really sits behind the shared wrapper (api/_api.js): a new endpoint that forgets
// it fails here.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let fetchCalls = [];
globalThis.fetch = async (url) => {
  fetchCalls.push(String(url));
  throw new Error('network disabled in tests');
};

const API_DIR = path.join(__dirname, '..', 'api');
const ENDPOINTS = fs.readdirSync(API_DIR)
  .filter((f) => f.endsWith('.js') && !f.startsWith('_'))
  .map((f) => f.replace(/\.js$/, ''))
  .sort();

function fakeRes() {
  const headers = {};
  return {
    headers, statusCode: 200, body: undefined, ended: false, headersSent: false,
    setHeader(k, v) { headers[k.toLowerCase()] = v; },
    getHeader(k) { return headers[k.toLowerCase()]; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; this.ended = true; this.headersSent = true; return this; },
    end() { this.ended = true; this.headersSent = true; return this; },
  };
}
const call = async (name, req = {}) => {
  const res = fakeRes();
  const fakeReq = { method: 'GET', query: {}, headers: {}, socket: { remoteAddress: `10.0.0.${Math.floor(Math.random() * 250)}` }, ...req };
  await require(`../api/${name}`)(fakeReq, res);
  return res;
};

test('the endpoint list is what we expect (a new file here needs a test below)', () => {
  assert.deepEqual(ENDPOINTS, ['chart', 'company', 'content', 'dashboard', 'financials', 'health', 'market', 'market-data', 'model-data', 'search']);
});

for (const name of ENDPOINTS) {
  test(`${name}: POST is refused with 405`, async () => {
    const res = await call(name, { method: 'POST', query: { symbol: 'AAPL' } });
    assert.equal(res.statusCode, 405);
    assert.equal(res.headers.allow, 'GET, HEAD, OPTIONS');
  });

  test(`${name}: a malformed symbol is a 400 before any work is done`, async () => {
    fetchCalls = [];
    const res = await call(name, { query: { symbol: '<script>alert(1)</script>' } });
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'Invalid symbol');
    assert.deepEqual(fetchCalls, []);
  });

  test(`${name}: only our own origins get CORS headers, never a wildcard`, async () => {
    const own = await call(name, { method: 'OPTIONS', headers: { origin: 'https://meridian.reachpointcapital.com' } });
    assert.equal(own.statusCode, 204);
    assert.equal(own.headers['access-control-allow-origin'], 'https://meridian.reachpointcapital.com');
    const other = await call(name, { method: 'OPTIONS', headers: { origin: 'https://evil.example' } });
    assert.equal(other.headers['access-control-allow-origin'], undefined);
  });
}

for (const name of ['company', 'content', 'dashboard', 'market', 'market-data']) {
  // 'constructor' is a lower-case word that is an inherited property of every object: it must not match a handler.
  for (const type of ['nonsense', 'constructor']) {
    test(`${name}: an unknown type (${type}) is a 400 that lists nothing sensitive`, async () => {
      const res = await call(name, { query: { type } });
      assert.equal(res.statusCode, 400);
      assert.match(res.body.error, /^Invalid type/);
    });
  }
}

test('article: a private or internal address is refused and never fetched', async () => {
  for (const url of ['http://169.254.169.254/latest/meta-data/', 'http://localhost:3000/', 'http://10.0.0.5/admin', 'file:///etc/passwd']) {
    fetchCalls = [];
    const res = await call('content', { query: { type: 'article', url } });
    assert.equal(res.statusCode, 400, url);
    assert.equal(res.body.error, 'That address cannot be fetched');
    assert.deepEqual(fetchCalls, [], url);
  }
});

test('health: answers without touching any upstream and says nothing about secrets', async () => {
  fetchCalls = [];
  const res = await call('health');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, 'ok');
  assert.deepEqual(fetchCalls, []);
  assert.doesNotMatch(JSON.stringify(res.body), /key|token|secret/i);
});

test('an upstream failure comes back as a plain message, with no URL or stack in it', async () => {
  const origError = console.error;
  console.error = () => {};
  try {
    const res = await call('dashboard', { query: { type: 'feargreed' } });
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error, 'Data is temporarily unavailable');
    assert.equal(res.headers['cache-control'], 'no-store');
  } finally {
    console.error = origError;
  }
});
