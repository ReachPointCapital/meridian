const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseFredCsv, twoYearFrom, withTwoYear } = require('../api/_macro');

// The 2-year yield used to come from Yahoo's `2YY=F`, a futures contract: once that contract expired it kept answering
// with a frozen price (4.75, change exactly 0) while every other yield moved. It now comes from FRED's daily DGS2 series.

const csv = (rows) => `observation_date,DGS2\n${rows.join('\n')}\n`;

test('twoYearFrom reads the latest value and the percent change from the day before', () => {
  const points = parseFredCsv(csv(['2026-11-17,4.38', '2026-11-18,4.40', '2026-11-19,4.44']));
  assert.deepEqual(twoYearFrom(points), { yield: 4.44, change: 0.91, date: '2026-11-19' });
});

test('twoYearFrom skips the blank "." rows FRED publishes on holidays and for the newest day', () => {
  const points = parseFredCsv(csv(['2026-11-18,4.40', '2026-11-19,4.44', '2026-11-20,.']));
  assert.deepEqual(twoYearFrom(points), { yield: 4.44, change: 0.91, date: '2026-11-19' });
});

test('twoYearFrom reports a fall as a negative change', () => {
  const points = parseFredCsv(csv(['2026-11-18,4.50', '2026-11-19,4.41']));
  assert.equal(twoYearFrom(points).change, -2);
});

test('twoYearFrom gives nothing when there are fewer than two usable points, rather than inventing a change', () => {
  assert.equal(twoYearFrom([]), null);
  assert.equal(twoYearFrom(parseFredCsv(csv(['2026-11-19,4.44']))), null);
  assert.equal(twoYearFrom(parseFredCsv(csv(['2026-11-18,.', '2026-11-19,4.44']))), null);
  assert.equal(twoYearFrom(null), null);
});

test('withTwoYear puts the FRED value in the 2Y slot of the Yahoo yields, with its date', () => {
  const yahoo = [{ maturity: '3M', yield: 4.1, change: -0.6 }, { maturity: '10Y', yield: 4.9, change: -2.8 }];
  const merged = withTwoYear(yahoo, { yield: 4.44, change: 0.91, date: '2026-11-19' });
  assert.deepEqual(merged.find((y) => y.maturity === '2Y'), { maturity: '2Y', yield: 4.44, change: 0.91, asOf: '2026-11-19' });
  assert.equal(merged.length, 3);
});

test('withTwoYear drops any 2Y row when FRED has nothing, so a stale number is never shown', () => {
  const stale = [{ maturity: '2Y', yield: 4.75, change: 0 }, { maturity: '10Y', yield: 4.9, change: -2.8 }];
  assert.deepEqual(withTwoYear(stale, null).map((y) => y.maturity), ['10Y']);
});

test('withTwoYear does not change the list it is given', () => {
  const yahoo = [{ maturity: '10Y', yield: 4.9, change: -2.8 }];
  withTwoYear(yahoo, { yield: 4.44, change: 0.91, date: '2026-11-19' });
  assert.equal(yahoo.length, 1);
});

// A regression guard: the expired futures symbol must not creep back into the app or the API. Comment lines are ignored so
// the code can still explain why it is gone.
const codeOnly = (text) => text.split('\n').filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line)).join('\n');
function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : sourceFiles(p);
    return /\.(js|jsx)$/.test(e.name) && !/\.test\.js$/.test(e.name) ? [p] : [];
  });
}

test('no app or API source reads the expired 2YY=F futures symbol', () => {
  const root = path.join(__dirname, '..');
  const offenders = [...sourceFiles(path.join(root, 'api')), ...sourceFiles(path.join(root, 'src'))]
    .filter((f) => codeOnly(fs.readFileSync(f, 'utf8')).includes('2YY'))
    .map((f) => path.relative(root, f));
  assert.deepEqual(offenders, []);
});
