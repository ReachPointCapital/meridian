const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isPrivateAddress, assertPublicUrl, fetchPublic } = require('../api/_safeFetch');

const publicResolver = async () => ['93.184.216.34'];

test('isPrivateAddress flags every non-public range', () => {
  for (const ip of [
    '127.0.0.1', '127.255.255.254', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254',
    '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255', '192.0.0.1',
    '::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', '::ffff:7f00:1',
  ]) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
});

test('isPrivateAddress lets public addresses through', () => {
  for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.32.0.1', '172.15.255.255', '2606:4700:4700::1111', '::ffff:8.8.8.8']) {
    assert.equal(isPrivateAddress(ip), false, ip);
  }
});

test('anything that is not an IP address is treated as unsafe', () => {
  assert.equal(isPrivateAddress('not-an-ip'), true);
  assert.equal(isPrivateAddress(''), true);
});

test('assertPublicUrl accepts an ordinary https URL', async () => {
  const u = await assertPublicUrl('https://example.com/a?b=1', { resolve: publicResolver });
  assert.equal(u.href, 'https://example.com/a?b=1');
});

test('assertPublicUrl rejects other schemes, credentials and unusual ports', async () => {
  for (const url of ['ftp://example.com/x', 'file:///etc/passwd', 'javascript:alert(1)', 'https://user:pw@example.com/', 'https://example.com:8080/', 'not a url', '']) {
    await assert.rejects(() => assertPublicUrl(url, { resolve: publicResolver }), /not allowed|Invalid URL/, url);
  }
});

test('assertPublicUrl rejects local and internal hostnames', async () => {
  for (const url of ['http://localhost/', 'http://foo.localhost/', 'http://printer.local/', 'http://db.internal/', 'http://router.lan/']) {
    await assert.rejects(() => assertPublicUrl(url, { resolve: publicResolver }), /not allowed/, url);
  }
});

test('assertPublicUrl rejects private IP literals in every spelling', async () => {
  for (const url of ['http://127.0.0.1/', 'http://[::1]/', 'http://169.254.169.254/latest/meta-data/', 'http://2130706433/', 'http://0x7f.1/', 'http://10.0.0.5/', 'http://[::ffff:127.0.0.1]/']) {
    await assert.rejects(() => assertPublicUrl(url, { resolve: publicResolver }), /not allowed/, url);
  }
});

test('assertPublicUrl rejects a public-looking name that resolves to a private address', async () => {
  await assert.rejects(() => assertPublicUrl('https://sneaky.example/', { resolve: async () => ['10.0.0.5'] }), /not allowed/);
  await assert.rejects(() => assertPublicUrl('https://mixed.example/', { resolve: async () => ['93.184.216.34', '127.0.0.1'] }), /not allowed/);
  await assert.rejects(() => assertPublicUrl('https://nothing.example/', { resolve: async () => [] }), /not allowed/);
});

const html = (body = '<html>hi</html>', headers = { 'content-type': 'text/html; charset=utf-8' }) =>
  new Response(body, { status: 200, headers });

test('fetchPublic returns the page text and content type', async () => {
  const r = await fetchPublic('https://example.com/a', { fetchImpl: async () => html(), resolve: publicResolver });
  assert.equal(r.text, '<html>hi</html>');
  assert.match(r.contentType, /text\/html/);
  assert.equal(r.truncated, false);
});

test('fetchPublic never calls out when the host resolves privately', async () => {
  let called = false;
  await assert.rejects(
    () => fetchPublic('https://sneaky.example/', { fetchImpl: async () => { called = true; return html(); }, resolve: async () => ['10.0.0.5'] }),
    /not allowed/,
  );
  assert.equal(called, false);
});

test('fetchPublic follows redirects and re-checks every hop', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return calls.length === 1 ? new Response(null, { status: 302, headers: { location: '/next' } }) : html('final');
  };
  const r = await fetchPublic('https://example.com/start', { fetchImpl, resolve: publicResolver });
  assert.deepEqual(calls, ['https://example.com/start', 'https://example.com/next']);
  assert.equal(r.text, 'final');

  const resolve = async (host) => (host === 'evil.example' ? ['169.254.169.254'] : ['93.184.216.34']);
  const toPrivate = async () => new Response(null, { status: 301, headers: { location: 'https://evil.example/x' } });
  await assert.rejects(() => fetchPublic('https://example.com/', { fetchImpl: toPrivate, resolve }), /not allowed/);
});

test('fetchPublic gives up on redirect loops', async () => {
  const loop = async () => new Response(null, { status: 302, headers: { location: 'https://example.com/again' } });
  await assert.rejects(() => fetchPublic('https://example.com/', { fetchImpl: loop, resolve: publicResolver, maxRedirects: 3 }), /redirect/i);
});

test('fetchPublic truncates a huge body instead of buffering it', async () => {
  const r = await fetchPublic('https://example.com/', { fetchImpl: async () => html('x'.repeat(100)), resolve: publicResolver, maxBytes: 10 });
  assert.equal(r.text.length, 10);
  assert.equal(r.truncated, true);
});

test('fetchPublic times out a server that never answers', async () => {
  const hang = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  });
  await assert.rejects(() => fetchPublic('https://example.com/', { fetchImpl: hang, resolve: publicResolver, timeoutMs: 20 }), /timed out/i);
});

test('fetchPublic only reads text pages and reports upstream errors', async () => {
  for (const type of ['application/pdf', 'image/png', 'application/octet-stream']) {
    await assert.rejects(
      () => fetchPublic('https://example.com/', { fetchImpl: async () => html('x', { 'content-type': type }), resolve: publicResolver }),
      /content type/i, type,
    );
  }
  await assert.rejects(
    () => fetchPublic('https://example.com/', { fetchImpl: async () => new Response('no', { status: 403 }), resolve: publicResolver }),
    /403/,
  );
});
