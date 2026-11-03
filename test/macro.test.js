const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseFredCsv, parseBoeCsv, buildRelease, RELEASE_SERIES, nextFomcMeeting, buildCentralBanks, buildM2,
} = require('../api/_macro');

// A run of monthly points ending at (endYear, endMonth), oldest first.
function monthly(endYear, endMonth, values) {
  const out = [];
  let y = endYear;
  let m = endMonth;
  for (let i = values.length - 1; i >= 0; i--) {
    out.unshift({ date: `${y}-${String(m).padStart(2, '0')}-01`, value: values[i] });
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }
  return out;
}
const def = (id) => RELEASE_SERIES.find((s) => s.id === id);

test('parseFredCsv reads observations oldest-first and skips missing values', () => {
  const csv = 'observation_date,FEDFUNDS\r\n2026-07-01,4.33\r\n2026-08-01,.\r\n2026-09-01,3.75\r\n\r\n';
  assert.deepEqual(parseFredCsv(csv), [{ date: '2026-07-01', value: 4.33 }, { date: '2026-09-01', value: 3.75 }]);
});

test('parseFredCsv accepts the older DATE header and rejects an error page', () => {
  assert.equal(parseFredCsv('DATE,GDP\n2026-04-01,32563.03\n').length, 1);
  assert.deepEqual(parseFredCsv('<!DOCTYPE html><html><body>Not found</body></html>'), []);
  assert.deepEqual(parseFredCsv(''), []);
});

test('parseBoeCsv converts "13 Oct 2026" dates', () => {
  const csv = 'DATE,IUDBEDR\r\n13 Oct 2026,3.75\r\n14 Oct 2026,3.75\r\n';
  assert.deepEqual(parseBoeCsv(csv), [{ date: '2026-10-13', value: 3.75 }, { date: '2026-10-14', value: 3.75 }]);
  assert.deepEqual(parseBoeCsv('<html></html>'), []);
});

test('CPI is shown as year-over-year inflation, not the raw index level', () => {
  const values = [322, 323, 324, 325, 326, 327, 328, 329, 330, 331, 332, 333, 334, 335];
  const points = monthly(2026, 9, [319, 320, 321, ...values].slice(-14));
  const r = buildRelease(def('CPIAUCSL'), points);
  assert.equal(r.event, 'CPI (Inflation)');
  assert.match(r.actual, /^\d+\.\d% YoY$/);
  assert.match(r.previous, /^\d+\.\d% YoY$/);
  assert.equal(r.date, '2026-09-01');
  assert.equal(r.series, 'CPIAUCSL');
  assert.equal(r.country, 'US');
  assert.equal(r.estimate, null);
});

test('year-over-year compares against the same month a year earlier', () => {
  // 13 monthly points: 2025-09 = 300 and 2026-09 = 330, so the latest reading is +10.0% over the same month a year earlier
  const points = monthly(2026, 9, [300, 301, 302, 303, 304, 305, 306, 307, 308, 309, 310, 311, 330]);
  const r = buildRelease(def('CPIAUCSL'), points);
  assert.equal(r.value, 10);
  assert.equal(r.actual, '10.0% YoY');
  assert.equal(r.previous, null); // 2026-08 has no 2025-08 to compare with in this short series
});

test('rates and levels keep their own units', () => {
  const r = buildRelease(def('UNRATE'), monthly(2026, 9, [4.3, 4.2]));
  assert.equal(r.actual, '4.2%');
  assert.equal(r.previous, '4.3%');
  assert.ok(Math.abs(r.change - -0.1) < 1e-9);
  assert.equal(buildRelease(def('HOUST'), monthly(2026, 8, [1300, 1275])).actual, '1,275K');
  assert.equal(buildRelease(def('T10YIE'), monthly(2026, 9, [2.3, 2.32])).actual, '2.32%');
});

test('payrolls are shown as the monthly change, retail sales as month-over-month', () => {
  const jobs = buildRelease(def('PAYEMS'), monthly(2026, 9, [158800, 158900, 159044]));
  assert.equal(jobs.actual, '+144K');
  assert.equal(jobs.previous, '+100K');
  const retail = buildRelease(def('RSAFS'), monthly(2026, 9, [740000, 745021]));
  assert.equal(retail.actual, '+0.7% MoM');
  assert.equal(buildRelease(def('INDPRO'), monthly(2026, 9, [104, 103.5])).actual, '-0.5% MoM');
});

test('GDP growth uses the real annualised growth series', () => {
  const r = buildRelease(def('A191RL1Q225SBEA'), [{ date: '2026-01-01', value: 1.6 }, { date: '2026-04-01', value: 3.0 }]);
  assert.equal(r.actual, '3.0% QoQ ann.');
  assert.equal(r.event, 'GDP Growth');
});

test('a release without enough history is skipped', () => {
  assert.equal(buildRelease(def('CPIAUCSL'), monthly(2026, 9, [1, 2, 3])), null);
  assert.equal(buildRelease(def('UNRATE'), []), null);
});

test('the next FOMC meeting comes from the published calendar and never from the past', () => {
  assert.equal(nextFomcMeeting('2026-10-16'), '2026-10-28');
  assert.equal(nextFomcMeeting('2026-10-28'), '2026-10-28');
  assert.equal(nextFomcMeeting('2026-10-29'), '2026-12-09');
  assert.equal(nextFomcMeeting('2026-12-10'), null);
});

test('central banks are assembled from live sources, in a fixed order, skipping failures', async () => {
  const series = {
    FEDFUNDS: [{ date: '2026-09-01', value: 3.75 }],
    ECBDFR: [{ date: '2026-10-15', value: 2.5 }, { date: '2026-10-16', value: 2.5 }],
    IRSTCI01JPM156N: [{ date: '2026-09-01', value: 1.043 }],
  };
  const deps = {
    fetchSeries: async (id) => series[id],
    fetchBoe: async () => [{ date: '2026-10-15', value: 3.75 }],
    today: '2026-10-16',
  };
  const rows = await buildCentralBanks(deps);
  assert.deepEqual(rows.map((r) => r.name), ['Federal Reserve', 'ECB', 'Bank of England', 'Bank of Japan']);
  assert.deepEqual(rows.map((r) => r.rate), [3.75, 2.5, 3.75, 1.043]);
  assert.equal(rows[0].nextMeeting, '2026-10-28');
  assert.equal(rows[0].asOf, '2026-09-01');
  assert.equal(rows[0].source, 'fred');
  assert.equal(rows[2].source, 'boe');
  assert.equal(rows[1].nextMeeting, null);

  const partial = await buildCentralBanks({ ...deps, fetchSeries: async (id) => { if (id === 'ECBDFR') throw new Error('down'); return series[id]; } });
  assert.deepEqual(partial.map((r) => r.name), ['Federal Reserve', 'Bank of England', 'Bank of Japan']);

  const none = await buildCentralBanks({ fetchSeries: async () => { throw new Error('down'); }, fetchBoe: async () => { throw new Error('down'); }, today: '2026-10-16' });
  assert.deepEqual(none, []);
});

test('M2 keeps the last ten years of monthly points', () => {
  const points = monthly(2026, 8, Array.from({ length: 200 }, (_, i) => 15000 + i * 10));
  const [series] = buildM2(points);
  assert.equal(series.seriesId, 'M2SL');
  assert.equal(series.unit, 'Billions USD');
  assert.equal(series.source, 'fred');
  assert.equal(series.data.length, 120);
  assert.equal(series.data.at(-1).date, '2026-08-01');
  assert.deepEqual(buildM2([]), []);
});
