// Run with: npm run test:utils (forces a US timezone: the day-early date bug only shows west of UTC)
import {
  formatDate,
  formatDividendYield,
  formatLevel,
  formatQuoteValue,
  unitFor,
} from './formatters';

describe('formatDate', () => {
  test('a date-only string shows the same calendar day as the API sent', () => {
    expect(formatDate('2026-10-28')).toBe('Oct 28, 2026');
  });

  test('a UTC-midnight period date (earnings, statements) keeps its calendar day', () => {
    expect(formatDate('2025-09-30T00:00:00.000Z')).toBe('Sep 30, 2025');
    expect(formatDate('2026-01-01T00:00:00.000Z')).toBe('Jan 1, 2026');
  });

  test('a real timestamp still renders in the viewer\'s local day', () => {
    // 03:00Z is the previous evening in the US
    expect(formatDate('2026-10-28T03:00:00.000Z')).toBe('Oct 27, 2026');
  });

  test('empty and junk input', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('')).toBe('—');
    expect(formatDate('not a date')).toBe('not a date');
  });
});

describe('formatDividendYield', () => {
  test('the API sends a percentage, so 0.32 means 0.32% (not 32%)', () => {
    expect(formatDividendYield(0.32)).toBe('0.32%');
  });

  test('values at or above 1 are percentages too', () => {
    expect(formatDividendYield(2.5)).toBe('2.50%');
    expect(formatDividendYield(11.2)).toBe('11.20%');
  });

  test('missing data', () => {
    expect(formatDividendYield(null)).toBe('—');
    expect(formatDividendYield(undefined)).toBe('—');
    expect(formatDividendYield(NaN)).toBe('—');
  });
});

describe('unitFor', () => {
  test.each([
    ['AAPL', 'usd'],
    ['SPY', 'usd'],
    ['BTC-USD', 'usd'],
    ['GC=F', 'usd'],
    ['CL=F', 'usd'],
    ['^GSPC', 'index'],
    ['^VIX', 'index'],
    ['^N225', 'index'],
    ['ES=F', 'index'],
    ['NQ=F', 'index'],
    ['^TNX', 'yield'],
    ['^IRX', 'yield'],
    ['2YY=F', 'yield'],
    ['EURUSD=X', 'fx'],
    ['JPY=X', 'fx'],
  ])('%s is %s', (symbol, unit) => {
    expect(unitFor(symbol)).toBe(unit);
  });
});

describe('formatQuoteValue', () => {
  test('dollar instruments get a $', () => {
    expect(formatQuoteValue('SPY', 771.79)).toBe('$771.79');
    expect(formatQuoteValue('GC=F', 4198)).toBe('$4,198.00');
    expect(formatQuoteValue('BTC-USD', 82041.9)).toBe('$82,041.90');
  });

  test('index levels and futures points have no $', () => {
    expect(formatQuoteValue('^GSPC', 7744.06)).toBe('7,744.06');
    expect(formatQuoteValue('^VIX', 15.95)).toBe('15.95');
    expect(formatQuoteValue('ES=F', 7802)).toBe('7,802.00');
  });

  test('yields are percentages', () => {
    expect(formatQuoteValue('^TNX', 5.094)).toBe('5.09%');
    expect(formatQuoteValue('^IRX', 4.057)).toBe('4.06%');
  });

  test('currency pairs show four decimals and no $', () => {
    expect(formatQuoteValue('EURUSD=X', 1.1247329)).toBe('1.1247');
    expect(formatQuoteValue('JPY=X', 157.993)).toBe('157.9930');
  });

  test('missing values', () => {
    expect(formatQuoteValue('^GSPC', null)).toBe('—');
    expect(formatQuoteValue('SPY', undefined)).toBe('—');
    expect(formatQuoteValue('SPY', NaN)).toBe('—');
  });
});

describe('formatLevel', () => {
  test('thousands separators, two decimals, no currency', () => {
    expect(formatLevel(204324.27)).toBe('204,324.27');
    expect(formatLevel(7744.058)).toBe('7,744.06');
  });

  test('missing values', () => {
    expect(formatLevel(null)).toBe('—');
  });
});
