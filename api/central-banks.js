const { getCached, setCached } = require('./_cache');
const { FMP_KEY } = require('./_helpers');

// FRED graph endpoint — no API key required
const FRED_GRAPH = 'https://fred.stlouisfed.org/graph/fredgraph.json';

const BANKS = [
  { id: 'FEDFUNDS', name: 'Federal Reserve', country: 'US', nextMeeting: '2025-06-18' },
  { id: 'ECBDFR', name: 'ECB', country: 'EU', nextMeeting: '2025-06-05' },
  { id: 'BOEBR', name: 'Bank of England', country: 'UK', nextMeeting: '2025-06-19' },
  { id: 'IRSTCI01JPM156N', name: 'Bank of Japan', country: 'JP', nextMeeting: '2025-06-13' },
];

function parseFredResponse(json, seriesId) {
  // FRED graph JSON can have different structures
  // Try: json.observations (array of {date, value})
  // Try: json[seriesId] with nested data
  // Try: json.data (flat array)
  if (json.observations && Array.isArray(json.observations)) {
    const valid = json.observations.filter(o => o.value !== '.' && o.value != null);
    if (valid.length > 0) return parseFloat(valid[valid.length - 1].value);
  }
  if (json[seriesId]?.data && Array.isArray(json[seriesId].data)) {
    const data = json[seriesId].data;
    if (data.length > 0) {
      const last = data[data.length - 1];
      return parseFloat(Array.isArray(last) ? last[1] : last.value);
    }
  }
  // Try flat structure
  if (Array.isArray(json)) {
    const last = json[json.length - 1];
    if (last?.value != null) return parseFloat(last.value);
  }
  return null;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const cacheKey = 'central_banks';
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  // Tier 1: FRED
  try {
    const results = await Promise.allSettled(
      BANKS.map(async (b) => {
        const url = `${FRED_GRAPH}?id=${b.id}`;
        console.log(`[CentralBanks] Fetching FRED: ${b.name} (${b.id})`);
        const response = await fetch(url);
        const text = await response.text();
        let rate = null;
        try {
          const json = JSON.parse(text);
          rate = parseFredResponse(json, b.id);
        } catch (parseErr) {
          console.error(`[CentralBanks] JSON parse failed for ${b.id}:`, parseErr.message);
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
    console.log('[CentralBanks] FRED returned no valid rates');
  } catch (e) {
    console.error('Central Banks FRED failed:', e.message);
  }

  // Tier 2: FMP
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

  res.json([]);
};
