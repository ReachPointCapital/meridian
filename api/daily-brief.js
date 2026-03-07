const { getCached, setCached } = require('./_cache');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const cacheKey = 'daily_brief';
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) {
    return res.json({ brief: null, message: 'AI Daily Brief unavailable — API key not configured' });
  }

  try {
    // Gather market context
    const { yahooMacro } = require('./_yahoo');
    let context = '';
    try {
      const macro = await yahooMacro();
      context = macro
        .filter(m => m.price != null)
        .map(m => `${m.label}: $${Number(m.price).toFixed(2)} (${(m.changePercent ?? 0) >= 0 ? '+' : ''}${Number(m.changePercent ?? 0).toFixed(2)}%)`)
        .join(', ');
    } catch {}

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `You are a senior macro strategist writing a daily market brief. Today's market data: ${context || 'unavailable'}. Write a concise 3-4 paragraph daily market brief covering: 1) Key market moves and what's driving them, 2) Notable sector rotations or themes, 3) Key levels and events to watch. Be specific with numbers. Professional tone, no fluff. Date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.`
        }],
      }),
    });

    const data = await response.json();
    const brief = data?.content?.[0]?.text || null;

    if (brief) {
      const result = { brief, generatedAt: new Date().toISOString() };
      setCached(cacheKey, result, 3600); // cache 1 hour
      res.setHeader('X-Cache', 'MISS');
      return res.json(result);
    }

    res.json({ brief: null, message: 'AI generation returned empty response' });
  } catch (e) {
    console.error('Daily brief generation failed:', e.message);
    res.json({ brief: null, message: 'AI Daily Brief temporarily unavailable' });
  }
};
