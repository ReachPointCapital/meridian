const { getCached, setCached } = require('./_cache');

// FRED graph endpoint — no API key required
const FRED_GRAPH = 'https://fred.stlouisfed.org/graph/fredgraph.json';

const SERIES = [
  { id: 'M2SL', name: 'US M2 Money Supply', unit: 'Billions USD' },
];

function parseFredSeries(json, seriesId) {
  const points = [];
  // Try json.observations
  if (json.observations && Array.isArray(json.observations)) {
    const valid = json.observations.filter(o => o.value !== '.' && o.value != null);
    const slice = valid.slice(-24);
    for (const item of slice) {
      const value = parseFloat(item.value);
      if (!isNaN(value)) {
        points.push({ date: item.date, value });
      }
    }
    return points;
  }
  // Try json[seriesId].data
  if (json[seriesId]?.data && Array.isArray(json[seriesId].data)) {
    const data = json[seriesId].data.slice(-24);
    for (const item of data) {
      const date = Array.isArray(item) ? item[0] : item.date;
      const value = parseFloat(Array.isArray(item) ? item[1] : item.value);
      if (!isNaN(value)) {
        points.push({ date, value });
      }
    }
    return points;
  }
  return points;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const cacheKey = 'm2_supply';
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  try {
    const results = await Promise.allSettled(
      SERIES.map(async (s) => {
        const url = `${FRED_GRAPH}?id=${s.id}`;
        console.log(`[M2] Fetching FRED: ${s.name} (${s.id})`);
        const response = await fetch(url);
        const text = await response.text();
        let points = [];
        try {
          const json = JSON.parse(text);
          points = parseFredSeries(json, s.id);
        } catch (parseErr) {
          console.error(`[M2] JSON parse failed for ${s.id}:`, parseErr.message);
        }
        console.log(`[M2] ${s.name}: ${points.length} data points`);
        return { seriesId: s.id, name: s.name, unit: s.unit, data: points };
      })
    );

    const data = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value)
      .filter(d => d.data.length > 0);

    if (data.length > 0) {
      setCached(cacheKey, data, 3600);
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Source', 'fred');
      return res.json(data);
    }
    console.log('[M2] FRED returned no valid data');
  } catch (e) {
    console.error('M2 Supply FRED failed:', e.message);
  }

  res.json([]);
};
