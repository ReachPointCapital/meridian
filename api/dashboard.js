const { getCached, setCached } = require('./_cache');
const { FMP_KEY, FMP_BASE } = require('./_helpers');
const { yahooMacro, yahooYields, yahooCrypto } = require('./_yahoo');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// ── Central Banks constants ──
const FRED_API = 'https://api.stlouisfed.org/fred/series/observations';
const FRED_GRAPH = 'https://fred.stlouisfed.org/graph/fredgraph.json';
const FRED_API_KEY = process.env.FRED_API_KEY || null;

const CB_BANKS = [
  { id: 'FEDFUNDS', name: 'Federal Reserve', country: 'US', nextMeeting: '2026-06-17' },
  { id: 'ECBDFR', name: 'ECB', country: 'EU', nextMeeting: '2026-06-04' },
  { id: 'BOEBR', name: 'Bank of England', country: 'UK', nextMeeting: '2026-06-18' },
  { id: 'IRSTCI01JPM156N', name: 'Bank of Japan', country: 'JP', nextMeeting: '2026-06-12' },
];
const FALLBACK_RATES = [
  { name: 'Federal Reserve', country: 'US', seriesId: 'FEDFUNDS', rate: 4.33, nextMeeting: '2026-06-17', source: 'fallback' },
  { name: 'ECB', country: 'EU', seriesId: 'ECBDFR', rate: 2.65, nextMeeting: '2026-06-04', source: 'fallback' },
  { name: 'Bank of England', country: 'UK', seriesId: 'BOEBR', rate: 4.50, nextMeeting: '2026-06-18', source: 'fallback' },
  { name: 'Bank of Japan', country: 'JP', seriesId: 'IRSTCI01JPM156N', rate: 0.50, nextMeeting: '2026-06-12', source: 'fallback' },
];

// ── M2 constants ──
const M2_SERIES = [{ id: 'M2SL', name: 'US M2 Money Supply', unit: 'Billions USD' }];
const FALLBACK_M2 = [
  { seriesId: 'M2SL', name: 'US M2 Money Supply', unit: 'Billions USD', source: 'fallback', data: [
    { date: '2024-03-01', value: 20870.7 }, { date: '2024-04-01', value: 20867.2 },
    { date: '2024-05-01', value: 20929.5 }, { date: '2024-06-01', value: 21025.0 },
    { date: '2024-07-01', value: 21048.7 }, { date: '2024-08-01', value: 21106.2 },
    { date: '2024-09-01', value: 21221.4 }, { date: '2024-10-01', value: 21311.9 },
    { date: '2024-11-01', value: 21447.0 }, { date: '2024-12-01', value: 21533.1 },
    { date: '2025-01-01', value: 21561.8 }, { date: '2025-02-01', value: 21672.3 },
    { date: '2025-03-01', value: 21763.5 }, { date: '2025-04-01', value: 21820.1 },
    { date: '2025-05-01', value: 21893.6 }, { date: '2025-06-01', value: 21952.4 },
    { date: '2025-07-01', value: 22019.8 }, { date: '2025-08-01', value: 22078.3 },
    { date: '2025-09-01', value: 22145.7 }, { date: '2025-10-01', value: 22210.2 },
    { date: '2025-11-01', value: 22289.5 }, { date: '2025-12-01', value: 22364.1 },
    { date: '2026-01-01', value: 22418.7 }, { date: '2026-02-01', value: 22480.3 },
  ]},
];

function parseFredSeries(json, seriesId) {
  const points = [];
  if (json.observations && Array.isArray(json.observations)) {
    const valid = json.observations.filter(o => o.value !== '.' && o.value != null);
    for (const item of valid) { const value = parseFloat(item.value); if (!isNaN(value)) points.push({ date: item.date, value }); }
    return points;
  }
  if (json[seriesId]?.data && Array.isArray(json[seriesId].data)) {
    for (const item of json[seriesId].data) {
      const date = Array.isArray(item) ? item[0] : item.date;
      const value = parseFloat(Array.isArray(item) ? item[1] : item.value);
      if (!isNaN(value)) points.push({ date, value });
    }
    return points;
  }
  return points;
}

// ── Economic Releases constants ──
const ECON_SERIES = [
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
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  const { type } = req.query;

  // ── calendar (economic-calendar) ──
  if (type === 'calendar') {
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
      if (response.status === 401 || response.status === 403) console.error('[EconCal] FMP auth error on Tier 1');
      const text = await response.text();
      console.log('[EconCal] Tier 1 raw:', text.substring(0, 500));
      const data = JSON.parse(text);
      if (Array.isArray(data) && data.length > 0) { setCached(cacheKey, data, 21600); return res.json(data); }
    } catch (e) { console.error('[EconCal] Tier 1 failed:', e.message); }

    // Tier 2: FMP v3
    try {
      const url = `https://financialmodelingprep.com/api/v3/economic_calendar?from=${from}&to=${to}&apikey=${FMP_KEY}`;
      console.log('[EconCal] Tier 2:', url);
      const response = await fetch(url);
      console.log('[EconCal] Tier 2 status:', response.status);
      if (response.status === 401 || response.status === 403) console.error('[EconCal] FMP auth error on Tier 2');
      const text = await response.text();
      console.log('[EconCal] Tier 2 raw:', text.substring(0, 500));
      const data = JSON.parse(text);
      if (Array.isArray(data) && data.length > 0) { setCached(cacheKey, data, 21600); return res.json(data); }
    } catch (e) { console.error('[EconCal] Tier 2 failed:', e.message); }

    // Tier 3: FMP v3 without date params
    try {
      const url = `https://financialmodelingprep.com/api/v3/economic_calendar?apikey=${FMP_KEY}`;
      console.log('[EconCal] Tier 3 (no dates):', url);
      const response = await fetch(url);
      console.log('[EconCal] Tier 3 status:', response.status);
      const text = await response.text();
      console.log('[EconCal] Tier 3 raw:', text.substring(0, 500));
      const data = JSON.parse(text);
      if (Array.isArray(data) && data.length > 0) { setCached(cacheKey, data, 21600); return res.json(data); }
    } catch (e) { console.error('[EconCal] Tier 3 failed:', e.message); }

    // Tier 4: FRED release dates
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
                return upcoming ? { event: release.name, date: upcoming.date, country: 'US', impact: release.impact, estimate: null, previous: null, actual: null } : null;
              })
          )
        );
        const events = results.filter(r => r.status === 'fulfilled' && r.value !== null).map(r => r.value).sort((a, b) => new Date(a.date) - new Date(b.date));
        console.log(`[EconCal] Tier 4: ${events.length} FRED events found`);
        if (events.length > 0) { setCached(cacheKey, events, 21600); return res.json(events); }
      } catch (e) { console.error('[EconCal] Tier 4 (FRED) failed:', e.message); }
    }

    // Tier 5: Hardcoded recurring US economic events
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
          let d = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
          while (d <= endDate) {
            const first = new Date(d.getFullYear(), d.getMonth(), 1);
            while (first.getDay() !== 5) first.setDate(first.getDate() + 1);
            if (first >= startDate && first <= endDate) events.push({ event: r.event, date: first.toISOString().split('T')[0], country: r.country, impact: r.impact, estimate: null, previous: null, actual: null });
            d.setMonth(d.getMonth() + 1);
          }
        } else if (r.dayOfMonth === 'weekly-thursday') {
          let d = new Date(startDate);
          while (d.getDay() !== 4) d.setDate(d.getDate() + 1);
          while (d <= endDate) {
            events.push({ event: r.event, date: d.toISOString().split('T')[0], country: r.country, impact: r.impact, estimate: null, previous: null, actual: null });
            d.setDate(d.getDate() + 7);
          }
        } else {
          let d = new Date(startDate.getFullYear(), startDate.getMonth(), r.dayOfMonth);
          if (d < startDate) d.setMonth(d.getMonth() + 1);
          while (d <= endDate) {
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
      if (events.length > 0) { setCached(cacheKey, events, 21600); return res.json(events); }
    } catch (e) { console.error('[EconCal] Tier 5 (hardcoded) failed:', e.message); }

    console.log('[EconCal] All tiers exhausted, returning empty');
    return res.json([]);
  }

  // ── releases (economic-releases) ──
  if (type === 'releases') {
    const cacheKey = 'economic_releases';
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    if (FRED_API_KEY) {
      try {
        console.log('[EconReleases] Tier 1: FRED observations API');
        const results = await Promise.allSettled(
          ECON_SERIES.map(s =>
            fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=${s.id}&limit=2&sort_order=desc&api_key=${FRED_API_KEY}&file_type=json`)
              .then(r => r.json())
              .then(data => {
                const obs = data.observations || [];
                const latest = obs[0]; const prior = obs[1];
                const val = parseFloat(latest?.value); const prevVal = parseFloat(prior?.value);
                if (isNaN(val)) return null;
                return { event: s.name, actual: val, previous: isNaN(prevVal) ? null : prevVal, estimate: null, change: isNaN(prevVal) ? null : val - prevVal, date: latest?.date || '', country: 'US', impact: s.impact, series: s.id };
              })
          )
        );
        const releases = results.filter(r => r.status === 'fulfilled' && r.value !== null).map(r => r.value).sort((a, b) => new Date(b.date) - new Date(a.date));
        console.log(`[EconReleases] Tier 1: ${releases.length} releases found`);
        if (releases.length > 0) { setCached(cacheKey, releases, 21600); return res.json(releases); }
      } catch (e) { console.error('[EconReleases] Tier 1 failed:', e.message); }
    }

    try {
      console.log('[EconReleases] Tier 2: FRED graph JSON');
      const results = await Promise.allSettled(
        ECON_SERIES.map(s =>
          fetch(`${FRED_GRAPH}?id=${s.id}`)
            .then(r => r.json())
            .then(data => {
              const obs = data.observations || data.seriess?.[0]?.data || [];
              if (obs.length < 1) return null;
              const latest = obs[obs.length - 1]; const prior = obs.length >= 2 ? obs[obs.length - 2] : null;
              const val = parseFloat(latest?.value ?? latest?.[1]); const prevVal = prior ? parseFloat(prior?.value ?? prior?.[1]) : null;
              if (isNaN(val)) return null;
              const dateStr = latest?.date || (latest?.[0] ? new Date(latest[0]).toISOString().split('T')[0] : '');
              return { event: s.name, actual: val, previous: prevVal != null && !isNaN(prevVal) ? prevVal : null, estimate: null, change: prevVal != null && !isNaN(prevVal) ? val - prevVal : null, date: dateStr, country: 'US', impact: s.impact, series: s.id };
            })
        )
      );
      const releases = results.filter(r => r.status === 'fulfilled' && r.value !== null).map(r => r.value).sort((a, b) => new Date(b.date) - new Date(a.date));
      console.log(`[EconReleases] Tier 2: ${releases.length} releases found`);
      if (releases.length > 0) { setCached(cacheKey, releases, 21600); return res.json(releases); }
    } catch (e) { console.error('[EconReleases] Tier 2 failed:', e.message); }

    console.log('[EconReleases] All tiers exhausted, returning empty');
    return res.json([]);
  }

  // ── ipos ──
  if (type === 'ipos') {
    const today = new Date();
    const from = today.toISOString().split('T')[0];
    const sixtyDays = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
    const to = sixtyDays.toISOString().split('T')[0];
    const cacheKey = `ipos_${from}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    // Tier 1-4: FMP variants
    const fmpUrls = [
      `https://financialmodelingprep.com/api/v3/ipo_calendar?from=${from}&to=${to}&apikey=${FMP_KEY}`,
      `https://financialmodelingprep.com/api/v3/ipo-calendar-prospectus?from=${from}&to=${to}&apikey=${FMP_KEY}`,
      `https://financialmodelingprep.com/api/v3/ipo-calendar-confirmed?from=${from}&to=${to}&apikey=${FMP_KEY}`,
      `${FMP_BASE}/ipo_calendar?from=${from}&to=${to}&apikey=${FMP_KEY}`,
    ];
    for (let i = 0; i < fmpUrls.length; i++) {
      try {
        console.log(`[IPOs] Tier ${i + 1}:`, fmpUrls[i]);
        const response = await fetch(fmpUrls[i]);
        console.log(`[IPOs] Tier ${i + 1} status:`, response.status);
        if (response.status === 401 || response.status === 403) console.error(`[IPOs] FMP auth error on Tier ${i + 1}`);
        const text = await response.text();
        console.log(`[IPOs] Tier ${i + 1} raw:`, text.substring(0, 500));
        const data = JSON.parse(text);
        if (Array.isArray(data) && data.length > 0) { setCached(cacheKey, data, 86400); return res.json(data); }
      } catch (e) { console.error(`[IPOs] Tier ${i + 1} failed:`, e.message); }
    }

    // Tier 5: Yahoo screener
    try {
      console.log('[IPOs] Tier 5: Yahoo screener');
      const result = await yahooFinance.screener({ scrIds: 'ipo_upcoming', count: 25 });
      const quotes = result.quotes || [];
      if (quotes.length > 0) {
        const mapped = quotes.map(q => ({ symbol: q.symbol, company: q.longName || q.shortName || q.symbol, date: q.ipoExpectedDate || from, exchange: q.fullExchangeName || q.exchange, priceRange: q.ipoExpectedPrice ? `$${q.ipoExpectedPrice}` : null }));
        setCached(cacheKey, mapped, 86400); return res.json(mapped);
      }
    } catch (e) { console.error('[IPOs] Tier 5 (Yahoo screener) failed:', e.message); }

    // Tier 6: SEC EDGAR
    try {
      console.log('[IPOs] Tier 6: SEC EDGAR S-1/424B4');
      const headers = { 'User-Agent': 'Meridian/1.0 info@reachpointcapital.com' };
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
      const [s1Res, prospRes] = await Promise.allSettled([
        fetch(`https://efts.sec.gov/LATEST/search-index?forms=S-1&dateRange=custom&startdt=${thirtyDaysAgo}&enddt=${from}`, { headers }).then(r => r.json()),
        fetch(`https://efts.sec.gov/LATEST/search-index?forms=424B4&dateRange=custom&startdt=${thirtyDaysAgo}&enddt=${from}`, { headers }).then(r => r.json()),
      ]);
      const ipos = [];
      if (prospRes.status === 'fulfilled') {
        (prospRes.value.hits?.hits || []).slice(0, 8).forEach(hit => {
          ipos.push({ company: hit._source?.display_names?.[0] || hit._source?.entity_name || 'Unknown', symbol: '', exchange: '', date: hit._source?.file_date || '', priceRange: 'Priced' });
        });
      }
      if (s1Res.status === 'fulfilled') {
        (s1Res.value.hits?.hits || []).slice(0, 10).forEach(hit => {
          const company = hit._source?.display_names?.[0] || hit._source?.entity_name || 'Unknown';
          if (!ipos.find(i => i.company === company)) ipos.push({ company, symbol: '', exchange: '', date: hit._source?.file_date || '', priceRange: 'Filed (S-1)' });
        });
      }
      console.log(`[IPOs] Tier 6: ${ipos.length} SEC filings found`);
      if (ipos.length > 0) { ipos.sort((a, b) => new Date(b.date) - new Date(a.date)); setCached(cacheKey, ipos.slice(0, 15), 86400); return res.json(ipos.slice(0, 15)); }
    } catch (e) { console.error('[IPOs] Tier 6 (SEC EDGAR) failed:', e.message); }

    console.log('[IPOs] All tiers exhausted, returning empty');
    return res.json([]);
  }

  // ── feargreed ──
  if (type === 'feargreed') {
    const cacheKey = 'fear_greed';
    const cached = getCached(cacheKey);
    if (cached) { res.setHeader('X-Cache', 'HIT'); return res.json(cached); }
    try {
      const response = await fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)', 'Accept': 'application/json' },
      });
      if (!response.ok) { console.error(`Fear & Greed CNN HTTP error: ${response.status}`); throw new Error(`CNN returned ${response.status}`); }
      const data = await response.json();
      setCached(cacheKey, data, 1800); res.setHeader('X-Cache', 'MISS'); return res.json(data);
    } catch (error) {
      console.error('Fear & Greed fetch failed:', error.message);
      return res.status(500).json({ error: 'Failed to fetch Fear & Greed index.' });
    }
  }

  // ── centralbanks ──
  if (type === 'centralbanks') {
    const cacheKey = 'central_banks';
    const cached = getCached(cacheKey);
    if (cached) { res.setHeader('X-Cache', 'HIT'); return res.json(cached); }

    if (FRED_API_KEY) {
      try {
        const results = await Promise.allSettled(
          CB_BANKS.map(async (b) => {
            const url = `${FRED_API}?series_id=${b.id}&sort_order=desc&limit=1&file_type=json&api_key=${FRED_API_KEY}`;
            console.log(`[CentralBanks] Fetching FRED API: ${b.name} (${b.id})`);
            const response = await fetch(url); const json = await response.json();
            let rate = null; const obs = json?.observations;
            if (Array.isArray(obs) && obs.length > 0) { const val = obs[0].value; if (val !== '.' && val != null) rate = parseFloat(val); }
            console.log(`[CentralBanks] ${b.name}: rate=${rate}`);
            return { name: b.name, country: b.country, seriesId: b.id, rate, nextMeeting: b.nextMeeting };
          })
        );
        const data = results.filter(r => r.status === 'fulfilled').map(r => r.value).filter(d => d.rate !== null && !isNaN(d.rate));
        if (data.length > 0) { setCached(cacheKey, data, 3600); res.setHeader('X-Cache', 'MISS'); res.setHeader('X-Source', 'fred'); return res.json(data); }
        console.log('[CentralBanks] FRED API returned no valid rates');
      } catch (e) { console.error('Central Banks FRED API failed:', e.message); }
    }

    try {
      const results = await Promise.allSettled(
        CB_BANKS.map(async (b) => {
          const url = `${FRED_GRAPH}?id=${b.id}`;
          const response = await fetch(url); const text = await response.text();
          let rate = null;
          try {
            const json = JSON.parse(text);
            if (json.observations && Array.isArray(json.observations)) { const valid = json.observations.filter(o => o.value !== '.' && o.value != null); if (valid.length > 0) rate = parseFloat(valid[valid.length - 1].value); }
            if (rate == null && json[b.id]?.data && Array.isArray(json[b.id].data)) { const d = json[b.id].data; if (d.length > 0) { const last = d[d.length - 1]; rate = parseFloat(Array.isArray(last) ? last[1] : last.value); } }
          } catch (parseErr) { console.error(`[CentralBanks] JSON parse failed for ${b.id}:`, parseErr.message); }
          return { name: b.name, country: b.country, seriesId: b.id, rate, nextMeeting: b.nextMeeting };
        })
      );
      const data = results.filter(r => r.status === 'fulfilled').map(r => r.value).filter(d => d.rate !== null && !isNaN(d.rate));
      if (data.length > 0) { setCached(cacheKey, data, 3600); res.setHeader('X-Cache', 'MISS'); res.setHeader('X-Source', 'fred-graph'); return res.json(data); }
      console.log('[CentralBanks] FRED graph returned no valid rates');
    } catch (e) { console.error('Central Banks FRED graph failed:', e.message); }

    try {
      const url = `https://financialmodelingprep.com/api/v4/treasury?apikey=${FMP_KEY}`;
      const response = await fetch(url); const data = await response.json();
      if (Array.isArray(data) && data.length > 0) { setCached(cacheKey, data, 3600); res.setHeader('X-Cache', 'MISS'); res.setHeader('X-Source', 'fmp'); return res.json(data); }
    } catch (e) { console.error('Central Banks FMP failed:', e.message); }

    console.log('[CentralBanks] All live sources failed, using fallback rates');
    setCached(cacheKey, FALLBACK_RATES, 1800); res.setHeader('X-Cache', 'MISS'); res.setHeader('X-Source', 'fallback');
    return res.json(FALLBACK_RATES);
  }

  // ── m2 ──
  if (type === 'm2') {
    const cacheKey = 'm2_supply';
    const cached = getCached(cacheKey);
    if (cached) { res.setHeader('X-Cache', 'HIT'); return res.json(cached); }

    if (FRED_API_KEY) {
      try {
        const today = new Date().toISOString().split('T')[0];
        const tenYearsAgo = new Date(Date.now() - 10 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const results = await Promise.allSettled(
          M2_SERIES.map(async (s) => {
            const url = `${FRED_API}?series_id=${s.id}&observation_start=${tenYearsAgo}&observation_end=${today}&limit=200&sort_order=asc&api_key=${FRED_API_KEY}&file_type=json`;
            console.log(`[M2] Fetching FRED API: ${s.name} (${s.id})`);
            const json = await (await fetch(url)).json();
            const points = []; const obs = json?.observations;
            if (Array.isArray(obs)) { for (const o of obs) { if (o.value !== '.' && o.value != null) { const v = parseFloat(o.value); if (!isNaN(v)) points.push({ date: o.date, value: v }); } } }
            console.log(`[M2] ${s.name}: ${points.length} data points`);
            return { seriesId: s.id, name: s.name, unit: s.unit, data: points };
          })
        );
        const data = results.filter(r => r.status === 'fulfilled').map(r => r.value).filter(d => d.data.length > 0);
        if (data.length > 0) { setCached(cacheKey, data, 3600); res.setHeader('X-Cache', 'MISS'); res.setHeader('X-Source', 'fred-api'); return res.json(data); }
        console.log('[M2] FRED API returned no valid data');
      } catch (e) { console.error('M2 FRED API failed:', e.message); }
    }

    try {
      const results = await Promise.allSettled(
        M2_SERIES.map(async (s) => {
          const url = `${FRED_GRAPH}?id=${s.id}`;
          console.log(`[M2] Fetching FRED graph: ${s.name} (${s.id})`);
          const response = await fetch(url); const text = await response.text();
          let points = [];
          try { const json = JSON.parse(text); points = parseFredSeries(json, s.id); } catch (parseErr) { console.error(`[M2] JSON parse failed for ${s.id}:`, parseErr.message); }
          console.log(`[M2] ${s.name}: ${points.length} data points`);
          return { seriesId: s.id, name: s.name, unit: s.unit, data: points };
        })
      );
      const data = results.filter(r => r.status === 'fulfilled').map(r => r.value).filter(d => d.data.length > 0);
      if (data.length > 0) { setCached(cacheKey, data, 3600); res.setHeader('X-Cache', 'MISS'); res.setHeader('X-Source', 'fred-graph'); return res.json(data); }
      console.log('[M2] FRED graph returned no valid data');
    } catch (e) { console.error('M2 Supply FRED graph failed:', e.message); }

    console.log('[M2] All live sources failed, using fallback data');
    setCached(cacheKey, FALLBACK_M2, 1800); res.setHeader('X-Cache', 'MISS'); res.setHeader('X-Source', 'fallback');
    return res.json(FALLBACK_M2);
  }

  // ── macro ──
  if (type === 'macro') {
    const cacheKey = 'macro_all';
    const cached = getCached(cacheKey);
    if (cached) { res.setHeader('X-Cache', 'HIT'); return res.json(cached); }
    try {
      const data = await yahooMacro();
      if (!data || data.length === 0) throw new Error('Yahoo returned empty macro data');
      setCached(cacheKey, data, 900); res.setHeader('X-Cache', 'MISS'); res.setHeader('X-Source', 'yahoo'); return res.json(data);
    } catch (e) { console.error('Macro Tier1 (Yahoo) failed:', e.message); }
    try {
      const symbols = 'SPY,QQQ,DIA,IWM,VXX,GLD,USO';
      const response = await fetch(`${FMP_BASE}/quote?symbol=${symbols}&apikey=${FMP_KEY}`);
      const quotes = await response.json();
      if (!Array.isArray(quotes) || quotes.length === 0) throw new Error('FMP returned empty quotes');
      const data = quotes.map(q => ({ symbol: q.symbol, label: q.name || q.symbol, price: q.price, change: q.change, changePercent: q.changesPercentage }));
      setCached(cacheKey, data, 900); res.setHeader('X-Cache', 'MISS'); res.setHeader('X-Source', 'fmp'); return res.json(data);
    } catch (e) { console.error('Macro Tier2 (FMP) failed:', e.message); }
    return res.status(500).json({ error: 'All macro sources failed' });
  }

  // ── yields ──
  if (type === 'yields') {
    const cacheKey = 'treasury_yields';
    const cached = getCached(cacheKey);
    if (cached) { res.setHeader('X-Cache', 'HIT'); return res.json(cached); }
    try {
      const yields = await yahooYields();
      if (!yields || yields.length === 0) throw new Error('Yahoo returned no yield data');
      const order = ['3M', '2Y', '5Y', '10Y', '30Y'];
      yields.sort((a, b) => order.indexOf(a.maturity) - order.indexOf(b.maturity));
      setCached(cacheKey, yields, 900); res.setHeader('X-Cache', 'MISS'); return res.json(yields);
    } catch (error) {
      console.error('Yields fetch failed:', error.message);
      return res.status(500).json({ error: 'Failed to fetch treasury yields' });
    }
  }

  return res.status(400).json({ error: 'Invalid type. Expected: calendar, releases, ipos, feargreed, centralbanks, m2, macro, yields' });
};
