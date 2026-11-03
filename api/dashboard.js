const { getCached, setCached } = require('./_cache');
const { yahooMacro, yahooYields } = require('./_yahoo');
const { fetchFredSeries, fetchBoeBankRate, RELEASE_SERIES, buildRelease, buildCentralBanks, buildM2 } = require('./_macro');
const { recurringEstimates, fomcEvents, buildIpoRows } = require('./_calendar');
const { withApi } = require('./_api');

const DAY = 86400000;
const isoDate = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => isoDate(new Date(Date.now() - n * DAY));

// FRED and the Bank of England publish these as public CSV files, so nothing here needs an API key, and when a
// source is down the answer is an error, never a hard-coded number that has gone stale.

async function edgarHits(form, start, end) {
  const url = `https://efts.sec.gov/LATEST/search-index?forms=${form}&dateRange=custom&startdt=${start}&enddt=${end}`;
  const response = await fetch(url, { headers: { 'User-Agent': 'Meridian/1.0 info@reachpointcapital.com' }, signal: AbortSignal.timeout(6000) });
  if (!response.ok) throw new Error(`SEC EDGAR responded ${response.status}`);
  const json = await response.json();
  return (json.hits && json.hits.hits) || [];
}

// Each type: ttl (seconds; in memory and as the CDN s-maxage), key(query) for the in-memory cache, and load(query).
const TYPES = new Map([
  ['calendar', {
    ttl: 3600,
    key: (q) => `econ_${q.from || ''}_${q.to || ''}`,
    // Official FOMC days plus clearly labelled "(est.)" rules of thumb for the other regular releases.
    load: async (q) => {
      const today = new Date();
      const from = q.from || isoDate(today);
      const to = q.to || isoDate(new Date(today.getTime() + 7 * DAY));
      return [...fomcEvents(from, to), ...recurringEstimates(from, to)]
        .sort((a, b) => a.date.localeCompare(b.date) || Number(a.estimated) - Number(b.estimated) || a.event.localeCompare(b.event));
    },
  }],
  ['releases', {
    ttl: 3600,
    load: async () => {
      const since = daysAgo(800); // enough history for a year-on-year figure and the one before it
      const settled = await Promise.allSettled(RELEASE_SERIES.map((series) => fetchFredSeries(series.id, { since })));
      const releases = settled
        .map((r, i) => (r.status === 'fulfilled' ? buildRelease(RELEASE_SERIES[i], r.value) : null))
        .filter(Boolean)
        .sort((a, b) => b.date.localeCompare(a.date));
      if (releases.length === 0) throw new Error('FRED returned no economic releases');
      return releases;
    },
  }],
  ['ipos', {
    ttl: 21600,
    load: async () => {
      const end = isoDate(new Date());
      const start = daysAgo(30);
      const [prospectus, s1] = await Promise.allSettled([edgarHits('424B4', start, end), edgarHits('S-1', start, end)]);
      if (prospectus.status === 'rejected' && s1.status === 'rejected') throw prospectus.reason;
      return buildIpoRows({
        prospectus: prospectus.status === 'fulfilled' ? prospectus.value : [],
        s1: s1.status === 'fulfilled' ? s1.value : [],
      });
    },
  }],
  ['feargreed', {
    ttl: 1800,
    load: async () => {
      const response = await fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)', Accept: 'application/json' },
        signal: AbortSignal.timeout(6000),
      });
      if (!response.ok) throw new Error(`CNN returned ${response.status}`);
      return response.json();
    },
  }],
  ['centralbanks', {
    ttl: 3600,
    load: async () => {
      const since = daysAgo(400);
      const rows = await buildCentralBanks({ fetchSeries: (id) => fetchFredSeries(id, { since }), fetchBoe: () => fetchBoeBankRate() });
      if (rows.length === 0) throw new Error('No central bank rates available');
      return rows;
    },
  }],
  ['m2', {
    ttl: 21600,
    load: async () => {
      const series = buildM2(await fetchFredSeries('M2SL', { since: daysAgo(3650) }));
      if (series.length === 0) throw new Error('FRED returned no M2 data');
      return series;
    },
  }],
  ['macro', {
    ttl: 120,
    load: async () => {
      const data = await yahooMacro();
      if (!data || data.length === 0) throw new Error('Yahoo returned no macro data');
      return data;
    },
  }],
  ['yields', {
    ttl: 120,
    load: async () => {
      const yields = await yahooYields();
      if (!yields || yields.length === 0) throw new Error('Yahoo returned no yield data');
      const order = ['3M', '2Y', '5Y', '10Y', '30Y'];
      return yields.sort((a, b) => order.indexOf(a.maturity) - order.indexOf(b.maturity));
    },
  }],
]);

async function handler(req, res) {
  const { type } = req.query;
  const spec = TYPES.get(type);
  if (!spec) return res.status(400).json({ error: `Invalid type. Expected: ${[...TYPES.keys()].join(', ')}` });

  const cacheKey = spec.key ? spec.key(req.query) : `dashboard_${type}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }
  const data = await spec.load(req.query);
  if (Array.isArray(data) && data.length === 0) {
    res.setHeader('Cache-Control', 'no-store'); // do not pin an empty answer
    return res.json(data);
  }
  setCached(cacheKey, data, spec.ttl);
  res.setHeader('X-Cache', 'MISS');
  return res.json(data);
}

module.exports = withApi(handler, {
  name: 'dashboard',
  cache: (query) => {
    const spec = TYPES.get(query.type);
    return spec ? { sMaxAge: spec.ttl, swr: spec.ttl * 2 } : null;
  },
});
