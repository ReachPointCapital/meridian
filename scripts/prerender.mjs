#!/usr/bin/env node
// Runs after `react-scripts build` (npm "postbuild").
//
// Meridian is a single-page app, so the build produces one HTML shell. Crawlers and link-preview bots that do not
// run JavaScript would see the same empty page for every address. This script uses that shell to write real HTML
// for each public page, with its own title, description, canonical address, heading, text and links:
//
//   build/index.html        the home page                                    (indexable)
//   build/<page>.html       one per indexable route in src/seo/routes.json   (served at /<page> via Vercel cleanUrls)
//   build/app.html          the shell for client-only pages (/login, /watchlist, ...)   (noindex)
//   build/404.html          served with a real 404 status for any other address         (noindex)
//   build/sitemap.xml       generated from the same route list
//
// React replaces the static text inside #root as soon as it starts, so visitors see the app, not this text.
// Tags React manages through react-helmet-async are marked data-rh="true", so the app replaces them
// instead of duplicating them.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROBOTS_INDEX = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
const NOT_FOUND_TEXT = 'We couldn’t find that page. It may have moved, or the address may be mistyped.';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ldScript = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

// Tags that the generated head replaces, so they are never duplicated.
const STRIP = [
  /<title>[\s\S]*?<\/title>/gi,
  /<meta\b[^>]*\bname=["'](?:description|robots|keywords)["'][^>]*>/gi,
  /<link\b[^>]*\brel=["']canonical["'][^>]*>/gi,
  /<meta\b[^>]*\bproperty=["']og:(?:url|title|description|image|image:alt)["'][^>]*>/gi,
  /<meta\b[^>]*\bname=["']twitter:(?:url|title|description|image|image:alt)["'][^>]*>/gi,
  /<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi,
];

const STATIC_CSS = '<style data-seo-static>'
  + '.seo-static{max-width:960px;margin:0 auto;padding:32px 20px 64px;font:15px/1.7 system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--text-secondary,#b9b6ae)}'
  + '.seo-static a{color:var(--gold,#cdb27a);text-decoration:none}'
  + '.seo-static nav{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:12px;letter-spacing:.08em;text-transform:uppercase}'
  + '.seo-static h1{color:var(--text-primary,#f3f1ec);font-size:32px;font-weight:600;margin:40px 0 8px}'
  + '.seo-static ul{margin:20px 0 0;padding-left:20px}.seo-static li{margin:4px 0}'
  + '.seo-static footer{margin-top:48px;font-size:12px}'
  + '</style>';

function navHtml(routes) {
  const items = routes.filter((r) => r.indexable && r.key !== 'disclaimer');
  return `<nav aria-label="Primary">${items.map((r) => `<a href="${r.path}">${esc(r.nav)}</a>`).join('')}</nav>`;
}

function bodyHtml(page, routes) {
  const features = (page.features || []).map((f) => {
    const label = f.path ? `<a href="${f.path}">${esc(f.label)}</a>` : esc(f.label);
    return `<li>${label}${f.text ? ` — ${esc(f.text)}` : ''}</li>`;
  }).join('');
  return `<div class="seo-static" data-seo-static>${navHtml(routes)}<main><h1>${esc(page.h1)}</h1><p>${esc(page.intro)}</p>`
    + `${features ? `<ul>${features}</ul>` : ''}</main>`
    + '<footer><a href="/disclaimer">Disclaimer</a> · &copy; Reach Point Research · Reach Point Capital LLC</footer></div>';
}

function socialTags(site, { title, description, url }) {
  return [
    `<meta property="og:title" content="${esc(title)}"/>`,
    `<meta property="og:description" content="${esc(description)}"/>`,
    `<meta property="og:url" content="${url}"/>`,
    `<meta property="og:image" content="${site.ogImage}"/>`,
    `<meta property="og:image:alt" content="${esc(site.ogImageAlt)}"/>`,
    `<meta name="twitter:title" content="${esc(title)}"/>`,
    `<meta name="twitter:description" content="${esc(description)}"/>`,
    `<meta name="twitter:url" content="${url}"/>`,
    `<meta name="twitter:image" content="${site.ogImage}"/>`,
    `<meta name="twitter:image:alt" content="${esc(site.ogImageAlt)}"/>`,
  ].join('');
}

const webApplicationLd = (site, home) => ({
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: site.name,
  url: `${site.origin}/`,
  description: 'Free institutional-grade financial terminal with real-time market data, stock analysis, DCF models, LBO analysis, and more.',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web',
  isAccessibleForFree: true,
  featureList: home.features.map((f) => f.label),
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  author: { '@type': 'Organization', name: site.publisher, url: 'https://reachpointcapital.com' },
  publisher: {
    '@type': 'Organization',
    name: 'Reach Point Capital LLC',
    url: 'https://reachpointcapital.com',
    logo: { '@type': 'ImageObject', url: `${site.origin}/logo192.png` },
  },
});

const pageLd = (site, route) => [
  {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: route.title,
    description: route.description,
    url: `${site.origin}${route.path}`,
    isPartOf: { '@type': 'WebApplication', name: site.name, url: `${site.origin}/` },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: site.name, item: `${site.origin}/` },
      { '@type': 'ListItem', position: 2, name: route.nav, item: `${site.origin}${route.path}` },
    ],
  },
];

function render(template, { title, description, canonical, robots, social = '', body = '', ld = [] }) {
  let html = STRIP.reduce((h, re) => h.replace(re, ''), template);
  const head = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" data-rh="true"/>`,
    // Not marked data-rh: the app never manages robots, so this tag stays exactly as written.
    `<meta name="robots" content="${robots || ROBOTS_INDEX}"/>`,
    canonical ? `<link rel="canonical" href="${canonical}" data-rh="true"/>` : '',
    social,
    ...ld.map(ldScript),
    body ? STATIC_CSS : '',
  ].join('');
  html = html.replace('</head>', `${head}</head>`);
  if (body) html = html.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
  return html;
}

export async function prerender({
  buildDir = path.join(ROOT, 'build'),
  routesPath = path.join(ROOT, 'src', 'seo', 'routes.json'),
} = {}) {
  const { site, routes } = JSON.parse(await fs.readFile(routesPath, 'utf8'));
  const template = await fs.readFile(path.join(buildDir, 'index.html'), 'utf8');
  if (!template.includes('<div id="root"></div>') || !template.includes('</head>')) {
    throw new Error('build/index.html does not have the expected shape (<div id="root"></div> and </head>); the prerender step needs updating.');
  }
  const home = routes.find((r) => r.key === 'home');
  const write = (name, html) => fs.writeFile(path.join(buildDir, name), html);
  const written = [];

  for (const route of routes.filter((r) => r.indexable)) {
    const url = `${site.origin}${route.path}`;
    const file = route.key === 'home' ? 'index.html' : `${route.path.slice(1)}.html`;
    await write(file, render(template, {
      title: route.title,
      description: route.description,
      canonical: url,
      social: socialTags(site, { title: route.title, description: route.description, url }),
      body: bodyHtml(route, routes),
      ld: route.key === 'home' ? [webApplicationLd(site, home)] : pageLd(site, route),
    }));
    written.push(file);
  }

  // Shell for the app's client-only pages (login, account, watchlist...): same app, but never indexed.
  await write('app.html', render(template, { title: home.title, description: home.description, robots: 'noindex, follow' }));
  written.push('app.html');

  // Shown with a real 404 status by Vercel for any address that is not a page. NotFound.js renders the same message.
  await write('404.html', render(template, {
    title: 'Page not found | Meridian',
    description: NOT_FOUND_TEXT,
    robots: 'noindex, follow',
    body: bodyHtml({ h1: 'Page not found', intro: NOT_FOUND_TEXT, features: [] }, routes),
  }));
  written.push('404.html');

  const urls = routes.filter((r) => r.indexable).map((r) => (
    `  <url>\n    <loc>${site.origin}${r.path}</loc>\n    <changefreq>${r.changefreq}</changefreq>\n    <priority>${r.priority}</priority>\n  </url>`
  )).join('\n');
  await write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  written.push('sitemap.xml');

  return { written };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  prerender()
    .then(({ written }) => console.log(`Prerendered ${written.length} files into build/: ${written.join(', ')}`))
    .catch((err) => { console.error(`Prerender failed: ${err.message}`); process.exit(1); });
}
