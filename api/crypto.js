const { getCached, setCached } = require('./_cache');
const { yahooCrypto } = require('./_yahoo');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const cacheKey = 'crypto_quotes';
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  try {
    const data = await yahooCrypto();
    if (!data || data.length === 0) throw new Error('Yahoo returned no crypto quotes');
    setCached(cacheKey, data, 300);
    res.setHeader('X-Cache', 'MISS');
    return res.json(data);
  } catch (error) {
    console.error('Crypto fetch failed:', error.message);
    res.status(500).json({ error: 'Failed to fetch crypto data' });
  }
};
