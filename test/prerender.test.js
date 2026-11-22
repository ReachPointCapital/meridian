const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'seo', 'routes.json'), 'utf8'));

// What `react-scripts build` writes to build/index.html (the shapes the prerender step edits).
const TEMPLATE = '<!doctype html><html lang="en" data-look="modern" data-tier="refined"><head><meta charset="utf-8"/>'
  + '<meta name="google-site-verification" content="abc"/><link rel="icon" href="/favicon.ico"/>'
  + '<title>Old title</title><meta name="description" content="Old description"/>'
  + '<meta name="keywords" content="old"/><meta name="robots" content="index, follow"/>'
  + '<link rel="canonical" href="https://meridian.reachpointcapital.com"/>'
  + '<meta property="og:type" content="website"/><meta property="og:url" content="https://old"/>'
  + '<meta property="og:title" content="Old"/><meta property="og:image" content="https://old/og.png"/>'
  + '<meta property="og:image:width" content="1200"/><meta name="twitter:card" content="summary_large_image"/>'
  + '<meta name="twitter:title" content="Old"/><script type="application/ld+json">{"@type":"WebApplication","name":"Old"}</script>'
  + '<script defer="defer" src="/static/js/main.abc.js"></script><link href="/static/css/main.abc.css" rel="stylesheet"></head>'
  + '<body><noscript>You need to enable JavaScript to run this app.</noscript><div id="root"></div></body></html>';

let dir;
let out;
const read = (name) => fs.readFileSync(path.join(dir, name), 'utf8');
const count = (html, re) => (html.match(re) || []).length;

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meridian-prerender-'));
  fs.writeFileSync(path.join(dir, 'index.html'), TEMPLATE);
  const { prerender } = await import('../scripts/prerender.mjs');
  out = await prerender({ buildDir: dir });
});

test('every indexable page has a unique title and description', () => {
  const pages = data.routes.filter((r) => r.indexable);
  assert.equal(new Set(pages.map((r) => r.title)).size, pages.length);
  assert.equal(new Set(pages.map((r) => r.description)).size, pages.length);
  for (const r of pages) {
    assert.ok(r.title.length > 10 && r.title.length <= 80, `${r.key} title length ${r.title.length}`);
    assert.ok(r.description.length >= 50 && r.description.length <= 200, `${r.key} description length ${r.description.length}`);
  }
});

test('each indexable page gets its own file with its own head and one canonical address', () => {
  for (const r of data.routes.filter((x) => x.indexable)) {
    const file = r.key === 'home' ? 'index.html' : `${r.path.slice(1)}.html`;
    assert.ok(out.written.includes(file), `${file} was written`);
    const html = read(file);
    assert.equal(count(html, /<title>/g), 1, `${r.key}: one <title>`);
    assert.ok(html.includes(`<title>${r.title.replace(/&/g, '&amp;')}</title>`), `${r.key}: title`);
    assert.equal(count(html, /<link rel="canonical"/g), 1, `${r.key}: exactly one canonical`);
    assert.ok(html.includes(`<link rel="canonical" href="${data.site.origin}${r.path}" data-rh="true"/>`), `${r.key}: canonical`);
    assert.equal(count(html, /<meta name="description"/g), 1, `${r.key}: one description`);
    assert.equal(count(html, /<meta name="robots"/g), 1, `${r.key}: one robots tag`);
    assert.ok(html.includes('max-image-preview:large'), `${r.key}: allows large previews`);
    assert.ok(!html.includes('noindex'), `${r.key}: is indexable`);
    assert.equal(count(html, /<h1>/g), 1, `${r.key}: one h1`);
    assert.ok(html.includes(`<h1>${r.h1.replace(/&/g, '&amp;')}</h1>`), `${r.key}: heading`);
    assert.ok(!html.includes('keywords'), `${r.key}: no keywords tag`);
    assert.ok(html.includes('google-site-verification'), `${r.key}: keeps the Search Console verification tag`);
    assert.ok(html.includes('/static/js/main.abc.js'), `${r.key}: keeps the app bundle`);
  }
});

test('pages link to each other with real anchors, and the social tags point at this page', () => {
  const html = read('models.html');
  for (const r of data.routes.filter((x) => x.indexable && x.key !== 'disclaimer')) {
    assert.ok(html.includes(`<a href="${r.path}">`), `links to ${r.path}`);
  }
  assert.ok(html.includes(`<meta property="og:url" content="${data.site.origin}/models"/>`));
  assert.ok(html.includes(`<meta property="og:image" content="${data.site.ogImage}"/>`));
  assert.equal(count(html, /property="og:image"/g), 1);
  assert.ok(html.includes('og:image:width'), 'keeps the image size tag from the template');
});

test('structured data: the home page is the WebApplication, other pages are WebPage + breadcrumbs', () => {
  const home = read('index.html');
  assert.equal(count(home, /application\/ld\+json/g), 1);
  assert.ok(home.includes('"@type":"WebApplication"') && home.includes('"featureList"') && home.includes('"price":"0"'));
  assert.ok(!home.includes('"name":"Old"'), 'old structured data is gone');
  const models = read('models.html');
  assert.ok(models.includes('"@type":"WebPage"') && models.includes('"@type":"BreadcrumbList"'));
  assert.ok(!models.includes('"@type":"WebApplication","name":"Meridian","url":"https://meridian.reachpointcapital.com/","description"'));
  for (const block of (models + home).match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    JSON.parse(block.replace(/<script[^>]*>|<\/script>/g, ''));
  }
});

test('the app shell for client-only pages is noindex and names no canonical', () => {
  const html = read('app.html');
  assert.ok(html.includes('<meta name="robots" content="noindex, follow"/>'));
  assert.equal(count(html, /<link rel="canonical"/g), 0);
  assert.ok(html.includes('<div id="root"></div>'), 'no static text, the app renders everything');
  assert.ok(html.includes('/static/js/main.abc.js'));
});

test('404.html is noindex with its own message', () => {
  const html = read('404.html');
  assert.ok(html.includes('<title>Page not found | Meridian</title>'));
  assert.ok(html.includes('noindex') && html.includes('<h1>Page not found</h1>'));
  assert.equal(count(html, /<link rel="canonical"/g), 0);
});

test('the sitemap lists exactly the indexable pages, in the standard namespace, with no dates', () => {
  const xml = read('sitemap.xml');
  assert.ok(xml.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'));
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(locs, data.routes.filter((r) => r.indexable).map((r) => `${data.site.origin}${r.path}`));
  assert.ok(!xml.includes('lastmod'));
  for (const p of data.clientOnly) assert.ok(!xml.includes(p), `${p} is not in the sitemap`);
});

test('it refuses a build whose index.html has an unexpected shape', async () => {
  const bad = fs.mkdtempSync(path.join(os.tmpdir(), 'meridian-prerender-bad-'));
  fs.writeFileSync(path.join(bad, 'index.html'), '<html><head></head><body><div id="app"></div></body></html>');
  const { prerender } = await import('../scripts/prerender.mjs');
  await assert.rejects(() => prerender({ buildDir: bad }), /unexpected shape|expected shape/);
});

test('vercel.json and the app agree on which paths are pages, client-only pages and 404s', () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  assert.equal(vercel.cleanUrls, true, 'clean URLs serve models.html at /models');
  assert.equal(vercel.trailingSlash, false);
  const shell = vercel.rewrites.find((r) => r.destination === '/app.html');
  assert.ok(shell, 'client-only pages are rewritten to the app shell');
  const listed = shell.source.match(/\(([^)]+)\)/)[1].split('|').map((p) => `/${p}`).sort();
  assert.deepEqual(listed, [...data.clientOnly].sort());
  assert.ok(!vercel.rewrites.some((r) => r.destination === '/index.html'), 'no catch-all: unknown addresses must 404');
  assert.ok(vercel.rewrites.some((r) => r.source.startsWith('/api/')), 'the API rewrite stays');
  // every path the app routes by tab is either a prerendered page or a client-only page
  const app = fs.readFileSync(path.join(ROOT, 'src', 'App.js'), 'utf8');
  const tabPaths = [...app.match(/const PATH_TO_TAB = \{([\s\S]*?)\};/)[1].matchAll(/'(\/[a-z-]+)'/g)].map((m) => m[1]);
  const known = new Set([...data.routes.map((r) => r.path), ...data.clientOnly]);
  for (const p of tabPaths) assert.ok(known.has(p), `${p} (a tab in App.js) is declared in routes.json`);
  for (const p of ['/', '/login', '/signup', '/reset-password', '/account', '/disclaimer']) assert.ok(known.has(p), `${p} is declared`);
});
