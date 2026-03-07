const { getCached, setCached } = require('./_cache');
const { FMP_KEY } = require('./_helpers');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const cacheKey = 'insider_trading_feed';
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  const mapTrades = (data) => data.slice(0, 30).map(t => ({
    symbol: t.symbol,
    name: t.reportingName || t.symbol,
    transactionType: t.transactionType,
    value: t.securitiesTransacted * (t.price || 0),
    shares: t.securitiesTransacted,
    price: t.price,
    date: t.filingDate || t.transactionDate,
    owner: t.reportingName,
    ownerType: t.typeOfOwner,
  }));

  const urls = [
    `https://financialmodelingprep.com/stable/insider-trading?limit=20&apikey=${FMP_KEY}`,
    `https://financialmodelingprep.com/api/v4/insider-trading?limit=20&apikey=${FMP_KEY}`,
    `https://financialmodelingprep.com/api/v4/insider-trading?page=0&apikey=${FMP_KEY}`,
    `https://financialmodelingprep.com/api/v3/insider-trading?limit=20&apikey=${FMP_KEY}`,
  ];

  for (let i = 0; i < urls.length; i++) {
    try {
      const response = await fetch(urls[i]);
      console.log(`[InsiderFeed] Tier ${i + 1}: status=${response.status}`);
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        const mapped = mapTrades(data);
        setCached(cacheKey, mapped, 1800);
        res.setHeader('X-Cache', 'MISS');
        return res.json(mapped);
      }
      console.log(`[InsiderFeed] Tier ${i + 1}: empty or not array (${typeof data})`);
    } catch (e) {
      console.error(`[InsiderFeed] Tier ${i + 1} failed:`, e.message);
    }
  }

  res.json([]);
};
