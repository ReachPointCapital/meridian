// Macro data from public sources that need no API key (see test/macro.test.js):
//   FRED     https://fred.stlouisfed.org/graph/fredgraph.csv?id=SERIES   (policy rates, M2, economic releases)
//   BoE      Bank of England database CSV, series IUDBEDR                (the official Bank Rate; FRED does not carry it)
// The old code fell back to fredgraph.json, which does not exist (404), then to hard-coded numbers that had gone stale
// (the Fed rate was shown 58 bp too high). When a source fails there is now nothing invented in its place.

const FRED_CSV = 'https://fred.stlouisfed.org/graph/fredgraph.csv';
const BOE_CSV = 'https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp';
const USER_AGENT = 'Mozilla/5.0 (compatible; Meridian/1.0; +https://meridian.reachpointcapital.com)';
const MONTHS = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };

const round = (n, places = 4) => (n == null ? null : Math.round(n * 10 ** places) / 10 ** places);

// ── parsing ──────────────────────────────────────────────────────────────────────────────────────
function parseFredCsv(text) {
  const lines = String(text || '').split(/\r?\n/);
  if (!/^(observation_date|date),/i.test(lines[0] || '')) return [];
  const out = [];
  for (const line of lines.slice(1)) {
    const [date, raw] = line.split(',');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) continue;
    const value = Number(raw);
    if (raw === undefined || raw === '' || raw === '.' || !Number.isFinite(value)) continue;
    out.push({ date, value });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}

function parseBoeCsv(text) {
  const out = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const m = line.match(/^(\d{1,2}) ([A-Za-z]{3}) (\d{4}),(-?[\d.]+)/);
    if (!m || !MONTHS[m[2]]) continue;
    out.push({ date: `${m[3]}-${MONTHS[m[2]]}-${m[1].padStart(2, '0')}`, value: Number(m[4]) });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}

// ── fetching ─────────────────────────────────────────────────────────────────────────────────────
async function fetchFredSeries(id, { fetchImpl = (...a) => fetch(...a), since } = {}) {
  const url = `${FRED_CSV}?id=${encodeURIComponent(id)}${since ? `&cosd=${since}` : ''}`;
  const res = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`FRED ${id} responded ${res.status}`);
  const points = parseFredCsv(await res.text());
  if (points.length === 0) throw new Error(`FRED ${id} returned no data`);
  return points;
}

async function fetchBoeBankRate({ fetchImpl = (...a) => fetch(...a), now = new Date() } = {}) {
  const from = new Date(now.getTime() - 90 * 86400000);
  const fmt = (d) => `${String(d.getUTCDate()).padStart(2, '0')}/${Object.keys(MONTHS)[d.getUTCMonth()]}/${d.getUTCFullYear()}`;
  const url = `${BOE_CSV}?csv.x=yes&Datefrom=${fmt(from)}&Dateto=now&SeriesCodes=IUDBEDR&CSVF=TN&UsingCodes=Y&VPD=Y&VFD=N`;
  const res = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Bank of England responded ${res.status}`);
  const points = parseBoeCsv(await res.text());
  if (points.length === 0) throw new Error('Bank of England returned no data');
  return points;
}

// ── economic releases: raw FRED levels turned into the numbers people actually quote ────────────
// kind: level (the value as is) | yoy (% change on the same month a year earlier) | mom (% change on the month before)
//       diff (change on the month before). fmt decides how it is written.
const RELEASE_SERIES = [
  { id: 'CPIAUCSL', name: 'CPI (Inflation)', impact: 'High', kind: 'yoy', fmt: 'yoy' },
  { id: 'UNRATE', name: 'Unemployment Rate', impact: 'High', kind: 'level', fmt: 'pct1' },
  { id: 'A191RL1Q225SBEA', name: 'GDP Growth', impact: 'High', kind: 'level', fmt: 'qoq' },
  { id: 'PAYEMS', name: 'Nonfarm Payrolls', impact: 'High', kind: 'diff', fmt: 'diffK' },
  { id: 'FEDFUNDS', name: 'Federal Funds Rate', impact: 'High', kind: 'level', fmt: 'pct2' },
  { id: 'T10YIE', name: '10Y Inflation Expectations', impact: 'Medium', kind: 'level', fmt: 'pct2' },
  { id: 'RSAFS', name: 'Retail Sales', impact: 'Medium', kind: 'mom', fmt: 'mom' },
  { id: 'INDPRO', name: 'Industrial Production', impact: 'Medium', kind: 'mom', fmt: 'mom' },
  { id: 'HOUST', name: 'Housing Starts', impact: 'Low', kind: 'level', fmt: 'levelK' },
  { id: 'PCE', name: 'Personal Consumption', impact: 'High', kind: 'mom', fmt: 'mom' },
];

const signed = (v, digits) => `${v > 0 ? '+' : ''}${v.toFixed(digits)}`;
const FORMATTERS = {
  pct1: (v) => `${v.toFixed(1)}%`,
  pct2: (v) => `${v.toFixed(2)}%`,
  yoy: (v) => `${v.toFixed(1)}% YoY`,
  mom: (v) => `${signed(v, 1)}% MoM`,
  qoq: (v) => `${v.toFixed(1)}% QoQ ann.`,
  diffK: (v) => `${v > 0 ? '+' : ''}${Math.round(v)}K`,
  levelK: (v) => `${Math.round(v).toLocaleString('en-US')}K`,
};

const monthKey = (date) => date.slice(0, 7);
const yearAgoKey = (date) => `${Number(date.slice(0, 4)) - 1}-${date.slice(5, 7)}`;

// The value of a release at point index i, or null when the history needed is not there.
function valueAt(kind, points, i) {
  const p = points[i];
  if (!p) return null;
  if (kind === 'level') return p.value;
  if (kind === 'yoy') {
    const ago = points.find((q) => monthKey(q.date) === yearAgoKey(p.date));
    return ago && ago.value ? (p.value / ago.value - 1) * 100 : null;
  }
  const before = points[i - 1];
  if (!before) return null;
  if (kind === 'mom') return before.value ? (p.value / before.value - 1) * 100 : null;
  if (kind === 'diff') return p.value - before.value;
  return null;
}

function buildRelease(series, points) {
  if (!Array.isArray(points) || points.length === 0) return null;
  const last = points.length - 1;
  const latest = valueAt(series.kind, points, last);
  if (latest == null) return null;
  const previous = valueAt(series.kind, points, last - 1);
  const format = FORMATTERS[series.fmt];
  return {
    event: series.name,
    actual: format(latest),
    previous: previous == null ? null : format(previous),
    estimate: null,
    change: previous == null ? null : round(latest - previous),
    date: points[last].date,
    country: 'US',
    impact: series.impact,
    series: series.id,
    value: round(latest),
    previousValue: round(previous),
  };
}

// ── central banks ────────────────────────────────────────────────────────────────────────────────
// FOMC decision days from the Fed's published 2026 calendar (federalreserve.gov/monetarypolicy/fomccalendars.htm).
// Past the last date this returns null rather than showing a meeting that has already happened.
const FOMC_2026 = ['2026-01-28', '2026-03-18', '2026-04-29', '2026-06-17', '2026-07-29', '2026-09-16', '2026-10-28', '2026-12-09'];

function nextFomcMeeting(today) {
  return FOMC_2026.find((d) => d >= today) || null;
}

const BANKS = [
  { name: 'Federal Reserve', country: 'US', seriesId: 'FEDFUNDS', source: 'fred', nextMeeting: nextFomcMeeting },
  { name: 'ECB', country: 'EU', seriesId: 'ECBDFR', source: 'fred' },
  { name: 'Bank of England', country: 'UK', seriesId: 'IUDBEDR', source: 'boe' },
  { name: 'Bank of Japan', country: 'JP', seriesId: 'IRSTCI01JPM156N', source: 'fred' },
];

async function buildCentralBanks({ fetchSeries, fetchBoe, today = new Date().toISOString().slice(0, 10) }) {
  const results = await Promise.allSettled(BANKS.map((b) => (b.source === 'boe' ? fetchBoe() : fetchSeries(b.seriesId))));
  const rows = [];
  results.forEach((result, i) => {
    if (result.status !== 'fulfilled' || !result.value || result.value.length === 0) return;
    const b = BANKS[i];
    const latest = result.value[result.value.length - 1];
    rows.push({
      name: b.name,
      country: b.country,
      seriesId: b.seriesId,
      rate: latest.value,
      asOf: latest.date,
      nextMeeting: b.nextMeeting ? b.nextMeeting(today) : null,
      source: b.source,
    });
  });
  return rows;
}

// ── M2 ───────────────────────────────────────────────────────────────────────────────────────────
function buildM2(points) {
  if (!Array.isArray(points) || points.length === 0) return [];
  return [{ seriesId: 'M2SL', name: 'US M2 Money Supply', unit: 'Billions USD', source: 'fred', data: points.slice(-120) }];
}

module.exports = {
  parseFredCsv,
  parseBoeCsv,
  fetchFredSeries,
  fetchBoeBankRate,
  RELEASE_SERIES,
  buildRelease,
  FOMC_2026,
  nextFomcMeeting,
  buildCentralBanks,
  buildM2,
};
