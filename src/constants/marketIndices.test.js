import fs from 'fs';
import path from 'path';
import { MAIN_INDICES } from './marketIndices';
import { formatQuoteValue } from '../utils/formatters';

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

describe('MAIN_INDICES', () => {
  test('are the four real index levels, in display order', () => {
    expect(MAIN_INDICES.map((i) => [i.symbol, i.label])).toEqual([
      ['^GSPC', 'S&P 500'],
      ['^NDX', 'NASDAQ 100'],
      ['^DJI', 'Dow Jones'],
      ['^RUT', 'Russell 2000'],
    ]);
  });

  test('use index symbols, never the SPY/QQQ/DIA/IWM funds (a fund price is about a tenth of the index)', () => {
    for (const { symbol } of MAIN_INDICES) {
      expect(symbol.startsWith('^')).toBe(true);
      expect(['SPY', 'QQQ', 'DIA', 'IWM']).not.toContain(symbol);
    }
  });

  test('each has its own chart colour', () => {
    const colours = MAIN_INDICES.map((i) => i.color);
    colours.forEach((c) => expect(c).toMatch(/^#[0-9a-fA-F]{6}$/));
    expect(new Set(colours).size).toBe(MAIN_INDICES.length);
  });
});

describe('the screens read the shared list', () => {
  test.each([
    'components/dashboard/Dashboard.jsx',
    'pages/Home.jsx',
    'components/layout/MacroSidebar.jsx',
  ])('%s imports MAIN_INDICES', (file) => {
    const src = read(file);
    expect(src).toMatch(/import\s*\{[^}]*MAIN_INDICES[^}]*\}\s*from\s*'[^']*constants\/marketIndices'/);
  });

  test('the dashboard no longer shows or plots funds under index headings', () => {
    expect(read('components/dashboard/Dashboard.jsx')).not.toMatch(/'(SPY|QQQ|DIA|IWM)'/);
  });

  test('an index level is shown in points with no dollar sign, while a stock still shows dollars', () => {
    for (const { symbol } of MAIN_INDICES) expect(formatQuoteValue(symbol, 6910.39)).not.toContain('$');
    expect(formatQuoteValue('AAPL', 189.5)).toContain('$');
  });

  test('the dashboard index panel formats each price by its symbol, so index levels are not shown as dollars', () => {
    expect(read('components/dashboard/Dashboard.jsx')).toMatch(/formatQuoteValue\(idx\.symbol, q\.price\)/);
  });

  test('the home tiles and sidebar do not list funds as indices', () => {
    for (const file of ['pages/Home.jsx', 'components/layout/MacroSidebar.jsx']) {
      expect(read(file)).not.toMatch(/symbol:\s*'(SPY|QQQ|DIA|IWM)'/);
    }
  });
});
