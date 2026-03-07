const { getCached, setCached } = require('./_cache');
const { FMP_KEY } = require('./_helpers');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const today = new Date();
  const from = req.query.from || today.toISOString().split('T')[0];
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const to = req.query.to || nextWeek.toISOString().split('T')[0];

  const cacheKey = `econ_${from}_${to}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  // Try FMP stable
  try {
    const url = `https://financialmodelingprep.com/stable/economic_calendar?from=${from}&to=${to}&apikey=${FMP_KEY}`;
    console.log('Fetching economic calendar:', url);
    const response = await fetch(url);
    const text = await response.text();
    console.log('Economic calendar raw:', text.substring(0, 300));
    const data = JSON.parse(text);
    if (Array.isArray(data) && data.length > 0) {
      setCached(cacheKey, data, 21600);
      return res.json(data);
    }
  } catch (e) {
    console.error('FMP economic calendar failed:', e.message);
  }

  // Try FMP v3
  try {
    const url = `https://financialmodelingprep.com/api/v3/economic_calendar?from=${from}&to=${to}&apikey=${FMP_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      setCached(cacheKey, data, 21600);
      return res.json(data);
    }
  } catch (e) {
    console.error('FMP v3 economic calendar failed:', e.message);
  }

  res.json([]);
};
