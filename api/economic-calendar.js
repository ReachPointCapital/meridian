const { getCached, setCached } = require('./_cache');
const { FMP_KEY, FMP_BASE } = require('./_helpers');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const today = new Date();
  const from = req.query.from || today.toISOString().split('T')[0];
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const to = req.query.to || nextWeek.toISOString().split('T')[0];

  const cacheKey = `econ_${from}_${to}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  // Tier 1: FMP stable
  try {
    const url = `${FMP_BASE}/economic_calendar?from=${from}&to=${to}&apikey=${FMP_KEY}`;
    console.log('[EconCal] Tier 1:', url);
    const response = await fetch(url);
    console.log('[EconCal] Tier 1 status:', response.status);
    if (response.status === 401 || response.status === 403) {
      console.error('[EconCal] FMP auth error on Tier 1');
    }
    const text = await response.text();
    console.log('[EconCal] Tier 1 raw:', text.substring(0, 500));
    const data = JSON.parse(text);
    if (Array.isArray(data) && data.length > 0) {
      setCached(cacheKey, data, 21600);
      return res.json(data);
    }
  } catch (e) {
    console.error('[EconCal] Tier 1 failed:', e.message);
  }

  // Tier 2: FMP v3
  try {
    const url = `https://financialmodelingprep.com/api/v3/economic_calendar?from=${from}&to=${to}&apikey=${FMP_KEY}`;
    console.log('[EconCal] Tier 2:', url);
    const response = await fetch(url);
    console.log('[EconCal] Tier 2 status:', response.status);
    if (response.status === 401 || response.status === 403) {
      console.error('[EconCal] FMP auth error on Tier 2');
    }
    const text = await response.text();
    console.log('[EconCal] Tier 2 raw:', text.substring(0, 500));
    const data = JSON.parse(text);
    if (Array.isArray(data) && data.length > 0) {
      setCached(cacheKey, data, 21600);
      return res.json(data);
    }
  } catch (e) {
    console.error('[EconCal] Tier 2 failed:', e.message);
  }

  // Tier 3: FMP v3 without date params (returns recent)
  try {
    const url = `https://financialmodelingprep.com/api/v3/economic_calendar?apikey=${FMP_KEY}`;
    console.log('[EconCal] Tier 3 (no dates):', url);
    const response = await fetch(url);
    console.log('[EconCal] Tier 3 status:', response.status);
    const text = await response.text();
    console.log('[EconCal] Tier 3 raw:', text.substring(0, 500));
    const data = JSON.parse(text);
    if (Array.isArray(data) && data.length > 0) {
      setCached(cacheKey, data, 21600);
      return res.json(data);
    }
  } catch (e) {
    console.error('[EconCal] Tier 3 failed:', e.message);
  }

  // Tier 4: FRED release dates for key economic indicators (free)
  const FRED_API_KEY = process.env.FRED_API_KEY || null;
  if (FRED_API_KEY) {
    try {
      console.log('[EconCal] Tier 4: FRED release dates');
      const KEY_RELEASES = [
        { id: '10', name: 'Employment Situation (Jobs Report)', short: 'Nonfarm Payrolls', impact: 'High' },
        { id: '46', name: 'Consumer Price Index', short: 'CPI', impact: 'High' },
        { id: '50', name: 'Producer Price Index', short: 'PPI', impact: 'Medium' },
        { id: '18', name: 'Gross Domestic Product', short: 'GDP', impact: 'High' },
        { id: '175', name: 'Personal Income and Outlays', short: 'PCE', impact: 'High' },
        { id: '117', name: 'Retail Trade', short: 'Retail Sales', impact: 'Medium' },
        { id: '84', name: 'Industrial Production', short: 'Industrial Production', impact: 'Medium' },
        { id: '202', name: 'Housing Starts', short: 'Housing Starts', impact: 'Low' },
        { id: '157', name: 'Consumer Sentiment', short: 'Consumer Sentiment', impact: 'Medium' },
      ];
      const futureDate = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0];
      const results = await Promise.allSettled(
        KEY_RELEASES.map(release =>
          fetch(`https://api.stlouisfed.org/fred/release/dates?release_id=${release.id}&realtime_start=${from}&realtime_end=${futureDate}&include_release_dates_with_no_data=true&api_key=${FRED_API_KEY}&file_type=json`)
            .then(r => r.json())
            .then(data => {
              const dates = data.release_dates || [];
              const upcoming = dates.find(d => d.date >= from);
              return upcoming ? {
                event: release.name,
                date: upcoming.date,
                country: 'US',
                impact: release.impact,
                estimate: null,
                previous: null,
                actual: null,
              } : null;
            })
        )
      );
      const events = results
        .filter(r => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      console.log(`[EconCal] Tier 4: ${events.length} FRED events found`);
      if (events.length > 0) {
        setCached(cacheKey, events, 21600);
        return res.json(events);
      }
    } catch (e) {
      console.error('[EconCal] Tier 4 (FRED) failed:', e.message);
    }
  }

  // Tier 5: Hardcoded recurring US economic events (always returns data)
  try {
    console.log('[EconCal] Tier 5: Hardcoded recurring events');
    const RECURRING = [
      { event: 'Nonfarm Payrolls', country: 'US', impact: 'High', dayOfMonth: 'first-friday' },
      { event: 'CPI Release', country: 'US', impact: 'High', dayOfMonth: 12 },
      { event: 'FOMC Meeting Minutes', country: 'US', impact: 'High', dayOfMonth: 15 },
      { event: 'PPI Release', country: 'US', impact: 'Medium', dayOfMonth: 14 },
      { event: 'Retail Sales', country: 'US', impact: 'Medium', dayOfMonth: 16 },
      { event: 'GDP Estimate', country: 'US', impact: 'High', dayOfMonth: 28 },
      { event: 'PCE Price Index', country: 'US', impact: 'High', dayOfMonth: 30 },
      { event: 'ISM Manufacturing PMI', country: 'US', impact: 'Medium', dayOfMonth: 1 },
      { event: 'Consumer Confidence', country: 'US', impact: 'Medium', dayOfMonth: 25 },
      { event: 'Housing Starts', country: 'US', impact: 'Low', dayOfMonth: 18 },
      { event: 'Initial Jobless Claims', country: 'US', impact: 'Medium', dayOfMonth: 'weekly-thursday' },
    ];

    const events = [];
    const startDate = new Date(from);
    const endDate = new Date(to);

    for (const r of RECURRING) {
      if (r.dayOfMonth === 'first-friday') {
        // Find first Friday of each month in range
        let d = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        while (d <= endDate) {
          const first = new Date(d.getFullYear(), d.getMonth(), 1);
          while (first.getDay() !== 5) first.setDate(first.getDate() + 1);
          if (first >= startDate && first <= endDate) {
            events.push({ event: r.event, date: first.toISOString().split('T')[0], country: r.country, impact: r.impact, estimate: null, previous: null, actual: null });
          }
          d.setMonth(d.getMonth() + 1);
        }
      } else if (r.dayOfMonth === 'weekly-thursday') {
        // Every Thursday in range
        let d = new Date(startDate);
        while (d.getDay() !== 4) d.setDate(d.getDate() + 1);
        while (d <= endDate) {
          events.push({ event: r.event, date: d.toISOString().split('T')[0], country: r.country, impact: r.impact, estimate: null, previous: null, actual: null });
          d.setDate(d.getDate() + 7);
        }
      } else {
        // Specific day of month
        let d = new Date(startDate.getFullYear(), startDate.getMonth(), r.dayOfMonth);
        if (d < startDate) d.setMonth(d.getMonth() + 1);
        while (d <= endDate) {
          // Skip weekends
          const adj = new Date(d);
          if (adj.getDay() === 0) adj.setDate(adj.getDate() + 1);
          if (adj.getDay() === 6) adj.setDate(adj.getDate() + 2);
          events.push({ event: r.event, date: adj.toISOString().split('T')[0], country: r.country, impact: r.impact, estimate: null, previous: null, actual: null });
          d.setMonth(d.getMonth() + 1);
        }
      }
    }

    events.sort((a, b) => new Date(a.date) - new Date(b.date));
    console.log(`[EconCal] Tier 5: ${events.length} hardcoded events`);
    if (events.length > 0) {
      setCached(cacheKey, events, 21600);
      return res.json(events);
    }
  } catch (e) {
    console.error('[EconCal] Tier 5 (hardcoded) failed:', e.message);
  }

  console.log('[EconCal] All tiers exhausted, returning empty');
  res.json([]);
};
