const { getCached, setCached } = require('./_cache');
const { FMP_KEY, FMP_BASE } = require('./_helpers');
const { yahooNews, yahooGeneralNews } = require('./_yahoo');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  const { type } = req.query;

  // ── news ──
  if (type === 'news') {
    const { symbol } = req.query;
    const cacheKey = symbol ? `news_${symbol}` : 'news_general';
    const cached = getCached(cacheKey);
    if (cached) { res.setHeader('X-Cache', 'HIT'); return res.json(cached); }

    try {
      const data = symbol ? await yahooNews(symbol) : await yahooGeneralNews();
      if (data && data.length > 0) {
        setCached(cacheKey, data, 3600); res.setHeader('X-Cache', 'MISS'); res.setHeader('X-Source', 'yahoo'); return res.json(data);
      }
      throw new Error('Yahoo returned empty news');
    } catch (e) { console.error('News Tier1 (Yahoo) failed:', e.message); }

    try {
      let url;
      if (symbol) { url = `${FMP_BASE}/news/stock?symbols=${encodeURIComponent(symbol)}&limit=20&apikey=${FMP_KEY}`; }
      else { url = `${FMP_BASE}/news/general?limit=15&apikey=${FMP_KEY}`; }
      const response = await fetch(url);
      const data = await response.json();
      const result = Array.isArray(data) ? data : [];
      setCached(cacheKey, result, 3600); res.setHeader('X-Cache', 'MISS'); res.setHeader('X-Source', 'fmp'); return res.json(result);
    } catch (e) { console.error('News Tier2 (FMP) failed:', e.message); }

    return res.status(500).json({ error: 'All news sources failed' });
  }

  // ── article ──
  if (type === 'article') {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL required' });
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        }
      });
      const html = await response.text();
      let clean = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
        .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');
      const titleMatch = clean.match(/<title[^>]*>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].replace(/\s*\|.*$/, '').trim() : '';
      const descMatch = clean.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
      const description = descMatch ? descMatch[1] : '';
      let articleHtml = '';
      const articleMatch = clean.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
      if (articleMatch) { articleHtml = articleMatch[1]; }
      else { const mainMatch = clean.match(/<main[^>]*>([\s\S]*?)<\/main>/i); if (mainMatch) articleHtml = mainMatch[1]; }
      const text = (articleHtml || clean)
        .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim().substring(0, 5000);
      const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
      const image = ogImageMatch ? ogImageMatch[1] : null;
      return res.json({ title, description, text, image, url });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to fetch article', message: e.message });
    }
  }

  // ── dailybrief ──
  if (type === 'dailybrief') {
    const cacheKey = 'daily_brief';
    const cached = getCached(cacheKey);
    if (cached) { res.setHeader('X-Cache', 'HIT'); return res.json(cached); }
    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_KEY) return res.json({ brief: null, message: 'AI Daily Brief unavailable — API key not configured' });
    try {
      const { yahooMacro } = require('./_yahoo');
      let context = '';
      try {
        const macro = await yahooMacro();
        context = macro.filter(m => m.price != null).map(m => `${m.label}: $${Number(m.price).toFixed(2)} (${(m.changePercent ?? 0) >= 0 ? '+' : ''}${Number(m.changePercent ?? 0).toFixed(2)}%)`).join(', ');
      } catch {}
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 500,
          messages: [{ role: 'user', content: `You are a senior macro strategist writing a daily market brief. Today's market data: ${context || 'unavailable'}. Write a concise 3-4 paragraph daily market brief covering: 1) Key market moves and what's driving them, 2) Notable sector rotations or themes, 3) Key levels and events to watch. Be specific with numbers. Professional tone, no fluff. Date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.` }],
        }),
      });
      const data = await response.json();
      const brief = data?.content?.[0]?.text || null;
      if (brief) { const result = { brief, generatedAt: new Date().toISOString() }; setCached(cacheKey, result, 3600); res.setHeader('X-Cache', 'MISS'); return res.json(result); }
      return res.json({ brief: null, message: 'AI generation returned empty response' });
    } catch (e) {
      console.error('Daily brief generation failed:', e.message);
      return res.json({ brief: null, message: 'AI Daily Brief temporarily unavailable' });
    }
  }

  return res.status(400).json({ error: 'Invalid type. Expected: news, article, dailybrief' });
};
