const { getCached, setCached } = require('./_cache');

// FRED API — free key at https://fred.stlouisfed.org/docs/api/api_key.html
const FRED_API_KEY = process.env.FRED_API_KEY || null;
const FRED_GRAPH = 'https://fred.stlouisfed.org/graph/fredgraph.json';

const SERIES = [
  { id: 'CPIAUCSL', name: 'CPI (Inflation)', impact: 'High' },
  { id: 'UNRATE', name: 'Unemployment Rate', impact: 'High' },
  { id: 'GDP', name: 'GDP Growth', impact: 'High' },
  { id: 'PAYEMS', name: 'Nonfarm Payrolls', impact: 'High' },
  { id: 'FEDFUNDS', name: 'Federal Funds Rate', impact: 'High' },
  { id: 'T10YIE', name: '10Y Inflation Expectations', impact: 'Medium' },
  { id: 'RSAFS', name: 'Retail Sales', impact: 'Medium' },
  { id: 'INDPRO', name: 'Industrial Production', impact: 'Medium' },
  { id: 'HOUST', name: 'Housing Starts', impact: 'Low' },
  { id: 'PCE', name: 'Personal Consumption', impact: 'High' },
];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const cacheKey = 'economic_releases';
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  // Tier 1: FRED observations API (requires key)
  if (FRED_API_KEY) {
    try {
      console.log('[EconReleases] Tier 1: FRED observations API');
      const results = await Promise.allSettled(
        SERIES.map(s =>
          fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=${s.id}&limit=2&sort_order=desc&api_key=${FRED_API_KEY}&file_type=json`)
            .then(r => r.json())
            .then(data => {
              const obs = data.observations || [];
              const latest = obs[0];
              const prior = obs[1];
              const val = parseFloat(latest?.value);
              const prevVal = parseFloat(prior?.value);
              if (isNaN(val)) return null;
              return {
                event: s.name,
                actual: val,
                previous: isNaN(prevVal) ? null : prevVal,
                estimate: null,
                change: isNaN(prevVal) ? null : val - prevVal,
                date: latest?.date || '',
                country: 'US',
                impact: s.impact,
                series: s.id,
              };
            })
        )
      );
      const releases = results
        .filter(r => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      console.log(`[EconReleases] Tier 1: ${releases.length} releases found`);
      if (releases.length > 0) {
        setCached(cacheKey, releases, 21600);
        return res.json(releases);
      }
    } catch (e) {
      console.error('[EconReleases] Tier 1 failed:', e.message);
    }
  }

  // Tier 2: FRED graph JSON (no key needed)
  try {
    console.log('[EconReleases] Tier 2: FRED graph JSON');
    const results = await Promise.allSettled(
      SERIES.map(s =>
        fetch(`${FRED_GRAPH}?id=${s.id}`)
          .then(r => r.json())
          .then(data => {
            const obs = data.observations || data.seriess?.[0]?.data || [];
            if (obs.length < 1) return null;
            const latest = obs[obs.length - 1];
            const prior = obs.length >= 2 ? obs[obs.length - 2] : null;
            const val = parseFloat(latest?.value ?? latest?.[1]);
            const prevVal = prior ? parseFloat(prior?.value ?? prior?.[1]) : null;
            if (isNaN(val)) return null;
            const dateStr = latest?.date || (latest?.[0] ? new Date(latest[0]).toISOString().split('T')[0] : '');
            return {
              event: s.name,
              actual: val,
              previous: prevVal != null && !isNaN(prevVal) ? prevVal : null,
              estimate: null,
              change: prevVal != null && !isNaN(prevVal) ? val - prevVal : null,
              date: dateStr,
              country: 'US',
              impact: s.impact,
              series: s.id,
            };
          })
      )
    );
    const releases = results
      .filter(r => r.status === 'fulfilled' && r.value !== null)
      .map(r => r.value)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    console.log(`[EconReleases] Tier 2: ${releases.length} releases found`);
    if (releases.length > 0) {
      setCached(cacheKey, releases, 21600);
      return res.json(releases);
    }
  } catch (e) {
    console.error('[EconReleases] Tier 2 failed:', e.message);
  }

  console.log('[EconReleases] All tiers exhausted, returning empty');
  res.json([]);
};
