const { getCached, setCached } = require('./_cache');
const { yahooYields } = require('./_yahoo');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const cacheKey = 'treasury_yields';
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  try {
    const yields = await yahooYields();
    if (!yields || yields.length === 0) throw new Error('Yahoo returned no yield data');

    const order = ['3M', '2Y', '5Y', '10Y', '30Y'];
    yields.sort((a, b) => order.indexOf(a.maturity) - order.indexOf(b.maturity));

    setCached(cacheKey, yields, 900);
    res.setHeader('X-Cache', 'MISS');
    return res.json(yields);
  } catch (error) {
    console.error('Yields fetch failed:', error.message);
    res.status(500).json({ error: 'Failed to fetch treasury yields' });
  }
};
