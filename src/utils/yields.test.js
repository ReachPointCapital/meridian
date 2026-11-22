import fs from 'fs';
import path from 'path';
import { twoYearQuote, TWO_YEAR_SYMBOL } from './yields';

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

describe('twoYearQuote', () => {
  test('turns the 2Y row of the yields feed into a sidebar quote', () => {
    const yields = [
      { maturity: '3M', yield: 4.12, change: -0.6 },
      { maturity: '2Y', yield: 4.44, change: 0.91, asOf: '2026-11-19' },
      { maturity: '10Y', yield: 4.91, change: -2.77 },
    ];
    expect(twoYearQuote(yields)).toEqual({ symbol: TWO_YEAR_SYMBOL, price: 4.44, changePercent: 0.91, asOf: '2026-11-19' });
  });

  test('keeps the date, because FRED publishes a day behind the other tenors and the sidebar shows it on hover', () => {
    expect(twoYearQuote([{ maturity: '2Y', yield: 4.44, change: 0.91, asOf: '2026-11-19' }]).asOf).toBe('2026-11-19');
    expect(twoYearQuote([{ maturity: '2Y', yield: 4.44, change: 0.91 }]).asOf).toBeNull();
  });

  test('gives null when the feed has no usable 2Y, so the sidebar shows a dash and not a stale number', () => {
    expect(twoYearQuote([{ maturity: '10Y', yield: 4.91, change: -2.77 }])).toBeNull();
    expect(twoYearQuote([{ maturity: '2Y', yield: null, change: null }])).toBeNull();
    expect(twoYearQuote([])).toBeNull();
    expect(twoYearQuote(undefined)).toBeNull();
    expect(twoYearQuote({ error: 'x' })).toBeNull();
  });
});

describe('the 2Y row in the sidebar', () => {
  test('is a yield-feed row that is not asked of Yahoo', () => {
    const src = read('components/layout/MacroSidebar.jsx');
    expect(src).toMatch(/symbol:\s*'DGS2'[^}]*source:\s*'yields'/);
    expect(src).not.toMatch(/2YY/);
  });
});
