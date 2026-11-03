const { getCached, setCached } = require('./_cache');
const { yahooNews, yahooGeneralNews, yahooMacro } = require('./_yahoo');
const { fetchPublic, UrlNotAllowedError } = require('./_safeFetch');
const { extractArticle } = require('./_article');
const { withApi, createRateLimiter, clientIp, redactUrl } = require('./_api');

// The shared per-endpoint limit is generous because news is polled; these two do real work per call, so they get
// their own, tighter, per-client limits (per instance; see docs/backend.md for a Firewall rule that is global).
const articleLimiter = createRateLimiter({ limit: 20, windowMs: 60000 });
const briefLimiter = createRateLimiter({ limit: 5, windowMs: 60000 });

function tooManyRequests(limiter, req, res) {
  const verdict = limiter(clientIp(req));
  if (verdict.ok) return false;
  res.setHeader('Retry-After', String(verdict.retryAfter));
  res.status(429).json({ error: 'Too many requests' });
  return true;
}

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

// ── news ──
async function news(req, res) {
  const { symbol } = req.query;
  const cacheKey = symbol ? `news_${symbol}` : 'news_general';
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }
  const data = symbol ? await yahooNews(symbol) : await yahooGeneralNews();
  if (data.length === 0) {
    res.setHeader('Cache-Control', 'no-store'); // do not pin an empty answer
    return res.json([]);
  }
  setCached(cacheKey, data, 300);
  res.setHeader('X-Cache', 'MISS');
  res.setHeader('X-Source', 'yahoo');
  return res.json(data);
}

// ── article ── (fetches a page for a visitor, so it only talks to public hosts: see _safeFetch.js)
async function article(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL required' });
  const cacheKey = `article_${url}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }
  if (tooManyRequests(articleLimiter, req, res)) return undefined;

  let page;
  try {
    page = await fetchPublic(url, { headers: BROWSER_HEADERS });
  } catch (e) {
    if (e instanceof UrlNotAllowedError) return res.status(400).json({ error: 'That address cannot be fetched' });
    console.error('Article fetch failed:', redactUrl(e.message));
    return res.status(502).json({ error: 'Failed to fetch article' });
  }
  const data = extractArticle(page.text, page.url);
  setCached(cacheKey, data, 3600);
  res.setHeader('X-Cache', 'MISS');
  return res.json(data);
}

// ── dailybrief ──
const BRIEF_MODEL = () => process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
let pendingBrief = null; // concurrent cold requests on one instance share a single model call

async function generateBrief(apiKey) {
  let context = '';
  try {
    const macro = await yahooMacro();
    context = macro
      .filter((m) => m.price != null)
      .map((m) => `${m.label}: ${Number(m.price).toFixed(2)} (${(m.changePercent ?? 0) >= 0 ? '+' : ''}${Number(m.changePercent ?? 0).toFixed(2)}%)`)
      .join(', ');
  } catch (e) {
    console.warn('Daily brief: market context unavailable:', redactUrl(e.message));
  }
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: BRIEF_MODEL(),
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `You are a senior macro strategist writing a daily market brief. Today's market data: ${context || 'unavailable'}. Write a concise 3-4 paragraph daily market brief covering: 1) Key market moves and what's driving them, 2) Notable sector rotations or themes, 3) Key levels and events to watch. Be specific with numbers. Professional tone, no fluff. Date: ${today}.`,
      }],
    }),
    signal: AbortSignal.timeout(7000), // Vercel stops the function at 10 s
  });
  if (!response.ok) throw new Error(`Anthropic responded ${response.status}`);
  const data = await response.json();
  return data?.content?.[0]?.text || null;
}

async function dailyBrief(req, res) {
  const cacheKey = 'daily_brief';
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  const unavailable = (message) => {
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ brief: null, message });
  };
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return unavailable('AI Daily Brief unavailable');
  if (tooManyRequests(briefLimiter, req, res)) return undefined;

  try {
    pendingBrief = pendingBrief || generateBrief(apiKey).finally(() => { pendingBrief = null; });
    const brief = await pendingBrief;
    if (!brief) return unavailable('AI generation returned an empty response');
    const result = { brief, generatedAt: new Date().toISOString() };
    setCached(cacheKey, result, 3600);
    res.setHeader('X-Cache', 'MISS');
    return res.json(result);
  } catch (e) {
    console.error('Daily brief generation failed:', redactUrl(e.message));
    return unavailable('AI Daily Brief temporarily unavailable');
  }
}

async function handler(req, res) {
  const { type } = req.query;
  if (type === 'news') return news(req, res);
  if (type === 'article') return article(req, res);
  if (type === 'dailybrief') return dailyBrief(req, res);
  return res.status(400).json({ error: 'Invalid type. Expected: news, article, dailybrief' });
}

const CACHE = {
  news: { sMaxAge: 300, swr: 600 },
  article: { sMaxAge: 3600, swr: 86400 },
  dailybrief: { sMaxAge: 3600, swr: 3600 },
};

module.exports = withApi(handler, { name: 'content', cache: (query) => (Object.hasOwn(CACHE, query.type) ? CACHE[query.type] : null) });
