const { getCached, setCached } = require('./_cache');
const { ALPHA_KEY, ALPHA_BASE } = require('./_helpers');
const { yahooSectors } = require('./_yahoo');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const cacheKey = 'av_sectors';
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  // Tier 1: Yahoo sectors
  try {
    const data = await yahooSectors();
    if (!data || Object.keys(data).length === 0) throw new Error('Yahoo returned no sector data');
    const sectors = Object.entries(data).map(([sector, pctStr]) => ({
      sector,
      changesPercentage: parseFloat((pctStr || '0').replace('%', '')),
      source: 'yahoo',
    }));
    setCached(cacheKey, sectors, 1800);
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Source', 'yahoo');
    return res.json(sectors);
  } catch (e) {
    console.error('Sectors Tier1 (Yahoo) failed:', e.message);
  }

  // Tier 2: Alpha Vantage
  try {
    const url = `${ALPHA_BASE}?function=SECTOR&apikey=${ALPHA_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    const realtime = data['Rank A: Real-Time Performance'] || {};
    const sectors = Object.entries(realtime).map(([sector, pctStr]) => ({
      sector,
      changesPercentage: parseFloat((pctStr || '0').replace('%', '')),
    }));
    if (sectors.length === 0) throw new Error('Alpha Vantage returned no sector data');
    setCached(cacheKey, sectors, 1800);
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Source', 'alphavantage');
    return res.json(sectors);
  } catch (e) {
    console.error('Sectors Tier2 (AlphaVantage) failed:', e.message);
  }

  res.status(500).json({ error: 'All sector sources failed' });
};
