const { getCached, setCached } = require('./_cache');
const { FMP_KEY } = require('./_helpers');

// FRED HTTPS API (observations endpoint) — no API key required for basic access
const FRED_API = 'https://api.stlouisfed.org/fred/series/observations';
const FRED_API_KEY = process.env.FRED_API_KEY || null;

const BANKS = [
  { id: 'FEDFUNDS', name: 'Federal Reserve', country: 'US', nextMeeting: '2026-06-17' },
  { id: 'ECBDFR', name: 'ECB', country: 'EU', nextMeeting: '2026-06-04' },
  { id: 'BOEBR', name: 'Bank of England', country: 'UK', nextMeeting: '2026-06-18' },
  { id: 'IRSTCI01JPM156N', name: 'Bank of Japan', country: 'JP', nextMeeting: '2026-06-12' },
];

// Fallback rates updated periodically — used when all live sources fail
const FALLBACK_RATES = [
  { name: 'Federal Reserve', country: 'US', seriesId: 'FEDFUNDS', rate: 4.33, nextMeeting: '2026-06-17', source: 'fallback' },
  { name: 'ECB', country: 'EU', seriesId: 'ECBDFR', rate: 2.65, nextMeeting: '2026-06-04', source: 'fallback' },
  { name: 'Bank of England', country: 'UK', seriesId: 'BOEBR', rate: 4.50, nextMeeting: '2026-06-18', source: 'fallback' },
  { name: 'Bank of Japan', country: 'JP', seriesId: 'IRSTCI01JPM156N', rate: 0.50, nextMeeting: '2026-06-12', source: 'fallback' },
];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const cacheKey = 'central_banks';
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  // Tier 1: FRED observations API (requires API key)
  if (FRED_API_KEY) {
    try {
      const results = await Promise.allSettled(
        BANKS.map(async (b) => {
          const url = `${FRED_API}?series_id=${b.id}&sort_order=desc&limit=1&file_type=json&api_key=${FRED_API_KEY}`;
          console.log(`[CentralBanks] Fetching FRED API: ${b.name} (${b.id})`);
          const response = await fetch(url);
          const json = await response.json();
          let rate = null;
          const obs = json?.observations;
          if (Array.isArray(obs) && obs.length > 0) {
            const val = obs[0].value;
            if (val !== '.' && val != null) rate = parseFloat(val);
          }
          console.log(`[CentralBanks] ${b.name}: rate=${rate}`);
          return { name: b.name, country: b.country, seriesId: b.id, rate, nextMeeting: b.nextMeeting };
        })
      );

      const data = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value)
        .filter(d => d.rate !== null && !isNaN(d.rate));

      if (data.length > 0) {
        setCached(cacheKey, data, 3600);
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('X-Source', 'fred');
        return res.json(data);
      }
      console.log('[CentralBanks] FRED API returned no valid rates');
    } catch (e) {
      console.error('Central Banks FRED API failed:', e.message);
    }
  }

  // Tier 2: FRED graph JSON endpoint (no key needed)
  try {
    const FRED_GRAPH = 'https://fred.stlouisfed.org/graph/fredgraph.json';
    const results = await Promise.allSettled(
      BANKS.map(async (b) => {
        const url = `${FRED_GRAPH}?id=${b.id}`;
        const response = await fetch(url);
        const text = await response.text();
        let rate = null;
        try {
          const json = JSON.parse(text);
          if (json.observations && Array.isArray(json.observations)) {
            const valid = json.observations.filter(o => o.value !== '.' && o.value != null);
            if (valid.length > 0) rate = parseFloat(valid[valid.length - 1].value);
          }
          if (rate == null && json[b.id]?.data && Array.isArray(json[b.id].data)) {
            const d = json[b.id].data;
            if (d.length > 0) {
              const last = d[d.length - 1];
              rate = parseFloat(Array.isArray(last) ? last[1] : last.value);
            }
          }
        } catch (parseErr) {
          console.error(`[CentralBanks] JSON parse failed for ${b.id}:`, parseErr.message);
        }
        return { name: b.name, country: b.country, seriesId: b.id, rate, nextMeeting: b.nextMeeting };
      })
    );

    const data = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value)
      .filter(d => d.rate !== null && !isNaN(d.rate));

    if (data.length > 0) {
      setCached(cacheKey, data, 3600);
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Source', 'fred-graph');
      return res.json(data);
    }
    console.log('[CentralBanks] FRED graph returned no valid rates');
  } catch (e) {
    console.error('Central Banks FRED graph failed:', e.message);
  }

  // Tier 3: FMP
  try {
    const url = `https://financialmodelingprep.com/api/v4/treasury?apikey=${FMP_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      setCached(cacheKey, data, 3600);
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Source', 'fmp');
      return res.json(data);
    }
  } catch (e) {
    console.error('Central Banks FMP failed:', e.message);
  }

  // Tier 4: Hardcoded fallback (always shows something)
  console.log('[CentralBanks] All live sources failed, using fallback rates');
  setCached(cacheKey, FALLBACK_RATES, 1800);
  res.setHeader('X-Cache', 'MISS');
  res.setHeader('X-Source', 'fallback');
  res.json(FALLBACK_RATES);
};
