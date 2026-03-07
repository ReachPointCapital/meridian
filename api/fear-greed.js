const { getCached, setCached } = require('./_cache');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const cacheKey = 'fear_greed';
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  try {
    const response = await fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
        'Accept': 'application/json',
      },
    });
    if (!response.ok) {
      console.error(`Fear & Greed CNN HTTP error: ${response.status}`);
      throw new Error(`CNN returned ${response.status}`);
    }
    const data = await response.json();
    setCached(cacheKey, data, 1800);
    res.setHeader('X-Cache', 'MISS');
    return res.json(data);
  } catch (error) {
    console.error('Fear & Greed fetch failed:', error.message);
    res.status(500).json({ error: 'Failed to fetch Fear & Greed index. CNN endpoint may be unavailable.' });
  }
};
