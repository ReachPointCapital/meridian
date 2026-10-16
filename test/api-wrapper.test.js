const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withApi, redactUrl, publicError } = require('../api/_api');

function fakeRes() {
  const headers = {};
  return {
    headers, statusCode: 200, body: undefined, ended: false,
    setHeader(k, v) { headers[k.toLowerCase()] = v; },
    getHeader(k) { return headers[k.toLowerCase()]; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; this.ended = true; return this; },
    end() { this.ended = true; return this; },
  };
}
const fakeReq = (over = {}) => ({ method: 'GET', query: {}, headers: {}, socket: { remoteAddress: '9.9.9.9' }, ...over });
const ok = async (req, res) => res.json({ seen: req.query });

test('a valid GET reaches the handler with a normalised query', async () => {
  const res = fakeRes();
  await withApi(ok)(fakeReq({ query: { type: 'quote', symbol: 'aapl' } }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { seen: { type: 'quote', symbol: 'AAPL' } });
});

test('an invalid query is a 400 and the handler never runs', async () => {
  let called = false;
  const res = fakeRes();
  await withApi(async () => { called = true; })(fakeReq({ query: { symbol: '<script>' } }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'Invalid symbol');
  assert.equal(called, false);
});

test('only GET, HEAD and OPTIONS are allowed', async () => {
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
    const res = fakeRes();
    await withApi(ok)(fakeReq({ method }), res);
    assert.equal(res.statusCode, 405, method);
    assert.equal(res.headers.allow, 'GET, HEAD, OPTIONS');
  }
  const head = fakeRes();
  await withApi(ok)(fakeReq({ method: 'HEAD' }), head);
  assert.equal(head.statusCode, 200);
});

test('CORS: our own origins are allowed, everyone else gets no CORS headers', async () => {
  const allowed = ['https://meridian.reachpointcapital.com', 'https://reachpointcapital.com', 'http://localhost:3000',
    'https://meridian-git-feat-x-reachpointlabs-projects.vercel.app'];
  for (const origin of allowed) {
    const res = fakeRes();
    await withApi(ok)(fakeReq({ headers: { origin } }), res);
    assert.equal(res.headers['access-control-allow-origin'], origin, origin);
    assert.equal(res.headers.vary, 'Origin');
  }
  for (const origin of ['https://evil.example', 'https://meridian.reachpointcapital.com.evil.example', 'null']) {
    const res = fakeRes();
    await withApi(ok)(fakeReq({ headers: { origin } }), res);
    assert.equal(res.headers['access-control-allow-origin'], undefined, origin);
  }
  const same = fakeRes();
  await withApi(ok)(fakeReq(), same);
  assert.equal(same.headers['access-control-allow-origin'], undefined);
});

test('a preflight is answered without running the handler', async () => {
  let called = false;
  const res = fakeRes();
  await withApi(async () => { called = true; })(fakeReq({ method: 'OPTIONS', headers: { origin: 'http://localhost:3000' } }), res);
  assert.equal(res.statusCode, 204);
  assert.equal(res.headers['access-control-allow-methods'], 'GET, HEAD, OPTIONS');
  assert.equal(called, false);
});

test('successful responses get a CDN cache header from the endpoint policy', async () => {
  const res = fakeRes();
  await withApi(ok, { cache: () => ({ sMaxAge: 60, swr: 300 }) })(fakeReq(), res);
  assert.equal(res.headers['cache-control'], 'public, s-maxage=60, stale-while-revalidate=300');
});

test('errors are never cached, and a handler-set header is respected', async () => {
  const bad = fakeRes();
  await withApi(async (req, res) => res.status(500).json({ error: 'x' }), { cache: () => ({ sMaxAge: 60, swr: 300 }) })(fakeReq(), bad);
  assert.equal(bad.headers['cache-control'], 'no-store');

  const own = fakeRes();
  await withApi(async (req, res) => { res.setHeader('Cache-Control', 'no-store'); res.json({}); }, { cache: () => ({ sMaxAge: 60, swr: 300 }) })(fakeReq(), own);
  assert.equal(own.headers['cache-control'], 'no-store');
});

test('5xx messages from upstream libraries are replaced, and the original is logged', async (t) => {
  t.mock.method(console, 'error', () => {});
  const res = fakeRes();
  await withApi(async (req, res2) => res2.status(500).json({ error: 'Call `const yahooFinance = new YahooFinance()` first. Upgrading from v2?' }))(fakeReq(), res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error, 'Data is temporarily unavailable');
  assert.match(console.error.mock.calls[0].arguments.join(' '), /new YahooFinance/);
});

test('"not found" upstream errors become a 404', async (t) => {
  t.mock.method(console, 'error', () => {});
  const res = fakeRes();
  await withApi(async (req, res2) => res2.status(500).json({ error: 'Quote not found for symbol: ZZZZ99' }))(fakeReq(), res);
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error, 'Symbol not found');
});

test('4xx messages written by our own code pass through', async () => {
  const res = fakeRes();
  await withApi(async (req, res2) => res2.status(400).json({ error: 'Invalid type. Expected: news, article' }))(fakeReq(), res);
  assert.equal(res.body.error, 'Invalid type. Expected: news, article');
});

test('a handler that throws is a generic 500', async (t) => {
  t.mock.method(console, 'error', () => {});
  const res = fakeRes();
  await withApi(async () => { throw new Error('secret internals'); })(fakeReq(), res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error, 'Data is temporarily unavailable');
});

test('rate limit: per client, per window, with Retry-After', async () => {
  let now = 0;
  const handler = withApi(ok, { rateLimit: { limit: 2, windowMs: 1000, now: () => now } });
  const hit = async (ip) => { const res = fakeRes(); await handler(fakeReq({ headers: { 'x-forwarded-for': `${ip}, 10.0.0.1` } }), res); return res; };
  assert.equal((await hit('1.1.1.1')).statusCode, 200);
  assert.equal((await hit('1.1.1.1')).statusCode, 200);
  const blocked = await hit('1.1.1.1');
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.headers['retry-after'], '1');
  assert.equal((await hit('2.2.2.2')).statusCode, 200);
  now = 1001;
  assert.equal((await hit('1.1.1.1')).statusCode, 200);
});

test('redactUrl hides credentials in URLs before they are logged', () => {
  const out = redactUrl('https://fmp.example/stable/x?from=2026-10-01&apikey=SECRET123&api_key=S2&token=T3&symbol=AAPL');
  assert.ok(!/SECRET123|S2|T3/.test(out), out);
  assert.match(out, /from=2026-10-01/);
  assert.match(out, /symbol=AAPL/);
  assert.equal(redactUrl('not a url?apikey=ZZZ'), 'not a url?apikey=REDACTED');
});

test('publicError keeps only messages that are ours', () => {
  assert.equal(publicError(500, 'All quote sources failed'), 'Data is temporarily unavailable');
  assert.equal(publicError(400, 'Invalid symbol'), 'Invalid symbol');
  assert.equal(publicError(429, 'Too many requests'), 'Too many requests');
});
