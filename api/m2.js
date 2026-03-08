const { getCached, setCached } = require('./_cache');

// FRED endpoints
const FRED_API = 'https://api.stlouisfed.org/fred/series/observations';
const FRED_GRAPH = 'https://fred.stlouisfed.org/graph/fredgraph.json';
const FRED_API_KEY = process.env.FRED_API_KEY || null;

const SERIES = [
  { id: 'M2SL', name: 'US M2 Money Supply', unit: 'Billions USD' },
];

// Fallback M2 data (monthly, trailing 24 months through early 2026)
const FALLBACK_M2 = [
  { seriesId: 'M2SL', name: 'US M2 Money Supply', unit: 'Billions USD', source: 'fallback', data: [
    { date: '2024-03-01', value: 20870.7 },
    { date: '2024-04-01', value: 20867.2 },
    { date: '2024-05-01', value: 20929.5 },
    { date: '2024-06-01', value: 21025.0 },
    { date: '2024-07-01', value: 21048.7 },
    { date: '2024-08-01', value: 21106.2 },
    { date: '2024-09-01', value: 21221.4 },
    { date: '2024-10-01', value: 21311.9 },
    { date: '2024-11-01', value: 21447.0 },
    { date: '2024-12-01', value: 21533.1 },
    { date: '2025-01-01', value: 21561.8 },
    { date: '2025-02-01', value: 21672.3 },
    { date: '2025-03-01', value: 21763.5 },
    { date: '2025-04-01', value: 21820.1 },
    { date: '2025-05-01', value: 21893.6 },
    { date: '2025-06-01', value: 21952.4 },
    { date: '2025-07-01', value: 22019.8 },
    { date: '2025-08-01', value: 22078.3 },
    { date: '2025-09-01', value: 22145.7 },
    { date: '2025-10-01', value: 22210.2 },
    { date: '2025-11-01', value: 22289.5 },
    { date: '2025-12-01', value: 22364.1 },
    { date: '2026-01-01', value: 22418.7 },
    { date: '2026-02-01', value: 22480.3 },
  ]},
];

function parseFredSeries(json, seriesId) {
  const points = [];
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

  // Tier 1: FRED observations API (requires API key)
  if (FRED_API_KEY) {
    try {
      const results = await Promise.allSettled(
        SERIES.map(async (s) => {
          const url = `${FRED_API}?series_id=${s.id}&sort_order=asc&limit=24&offset=0&file_type=json&api_key=${FRED_API_KEY}&observation_start=2024-01-01`;
          console.log(`[M2] Fetching FRED API: ${s.name} (${s.id})`);
          const json = await (await fetch(url)).json();
          const points = [];
          const obs = json?.observations;
          if (Array.isArray(obs)) {
            for (const o of obs) {
              if (o.value !== '.' && o.value != null) {
                const v = parseFloat(o.value);
                if (!isNaN(v)) points.push({ date: o.date, value: v });
              }
            }
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
        res.setHeader('X-Source', 'fred-api');
        return res.json(data);
      }
      console.log('[M2] FRED API returned no valid data');
    } catch (e) {
      console.error('M2 FRED API failed:', e.message);
    }
  }

  // Tier 2: FRED graph JSON (no key needed)
  try {
    const results = await Promise.allSettled(
      SERIES.map(async (s) => {
        const url = `${FRED_GRAPH}?id=${s.id}`;
        console.log(`[M2] Fetching FRED graph: ${s.name} (${s.id})`);
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
      res.setHeader('X-Source', 'fred-graph');
      return res.json(data);
    }
    console.log('[M2] FRED graph returned no valid data');
  } catch (e) {
    console.error('M2 Supply FRED graph failed:', e.message);
  }

  // Tier 3: Hardcoded fallback (always shows something)
  console.log('[M2] All live sources failed, using fallback data');
  setCached(cacheKey, FALLBACK_M2, 1800);
  res.setHeader('X-Cache', 'MISS');
  res.setHeader('X-Source', 'fallback');
  res.json(FALLBACK_M2);
};
