/**
 * Technical indicator calculations for price history data.
 * Each function takes an array of { t, o, h, l, c, v } candle objects.
 */

/**
 * Calculate Exponential Moving Average for a series of values.
 * @param {number[]} values - Array of numeric values
 * @param {number} period - EMA period
 * @returns {number[]} EMA values (same length as input, first `period-1` are SMA-seeded)
 */
function ema(values, period) {
  if (!values || values.length === 0) return [];
  const k = 2 / (period + 1);
  const result = [];

  // Seed with SMA of first `period` values
  let sum = 0;
  for (let i = 0; i < Math.min(period, values.length); i++) {
    sum += values[i];
    result.push(sum / (i + 1)); // partial SMA for early values
  }

  // EMA from period onward
  for (let i = period; i < values.length; i++) {
    const prev = result[i - 1];
    result.push(values[i] * k + prev * (1 - k));
  }

  return result;
}

/**
 * Calculate RSI (Relative Strength Index).
 * @param {Array<{c: number}>} data - Price history with close prices
 * @param {number} period - RSI period (default 14)
 * @returns {{ value: number, label: 'Overbought' | 'Neutral' | 'Oversold' }}
 */
export function calculateRSI(data, period = 14) {
  if (!data || data.length < period + 1) {
    return { value: null, label: 'Neutral' };
  }

  // Filter out entries with null/undefined close
  const closes = data.map(d => d.c).filter(c => c != null);
  if (closes.length < period + 1) {
    return { value: null, label: 'Neutral' };
  }

  // Calculate price changes
  const changes = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  // Initial average gain/loss over first `period` changes
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] >= 0) {
      avgGain += changes[i];
    } else {
      avgLoss += Math.abs(changes[i]);
    }
  }
  avgGain /= period;
  avgLoss /= period;

  // Smooth with Wilder's method
  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    const gain = change >= 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);
  const value = Math.round(rsi * 100) / 100;

  let label = 'Neutral';
  if (value >= 70) label = 'Overbought';
  else if (value <= 30) label = 'Oversold';

  return { value, label };
}

/**
 * Calculate Simple Moving Average for the last data point.
 * @param {Array<{c: number}>} data - Price history with close prices
 * @param {number} period - SMA period
 * @returns {number|null} SMA value
 */
export function calculateSMA(data, period) {
  if (!data || data.length < period) return null;

  const closes = data.map(d => d.c).filter(c => c != null);
  if (closes.length < period) return null;

  const slice = closes.slice(closes.length - period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return Math.round((sum / period) * 100) / 100;
}

/**
 * Check for Golden Cross / Death Cross (50 vs 200 SMA).
 * @param {Array<{c: number}>} data - Price history with close prices
 * @returns {{ signal: 'Golden Cross' | 'Death Cross' | 'Neutral', sma50: number|null, sma200: number|null }}
 */
export function checkCrossSignal(data) {
  const result = { signal: 'Neutral', sma50: null, sma200: null };

  if (!data || data.length < 201) return result;

  const closes = data.map(d => d.c).filter(c => c != null);
  if (closes.length < 201) return result;

  // Current SMAs
  const sma50Now = closes.slice(-50).reduce((a, b) => a + b, 0) / 50;
  const sma200Now = closes.slice(-200).reduce((a, b) => a + b, 0) / 200;

  // Previous day SMAs (shift by 1)
  const sma50Prev = closes.slice(-51, -1).reduce((a, b) => a + b, 0) / 50;
  const sma200Prev = closes.slice(-201, -1).reduce((a, b) => a + b, 0) / 200;

  result.sma50 = Math.round(sma50Now * 100) / 100;
  result.sma200 = Math.round(sma200Now * 100) / 100;

  // Golden Cross: SMA50 crosses above SMA200
  if (sma50Prev <= sma200Prev && sma50Now > sma200Now) {
    result.signal = 'Golden Cross';
  }
  // Death Cross: SMA50 crosses below SMA200
  else if (sma50Prev >= sma200Prev && sma50Now < sma200Now) {
    result.signal = 'Death Cross';
  }
  // If no crossover just occurred, report current position
  else if (sma50Now > sma200Now) {
    result.signal = 'Golden Cross';
  } else if (sma50Now < sma200Now) {
    result.signal = 'Death Cross';
  }

  return result;
}

/**
 * Calculate MACD (12, 26, 9).
 * @param {Array<{c: number}>} data - Price history with close prices
 * @returns {{ macd: number|null, signal: number|null, histogram: number|null, label: 'Bullish' | 'Bearish' }}
 */
export function calculateMACD(data) {
  const result = { macd: null, signal: null, histogram: null, label: 'Bearish' };

  if (!data || data.length < 35) return result;

  const closes = data.map(d => d.c).filter(c => c != null);
  if (closes.length < 35) return result;

  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);

  // MACD line = EMA12 - EMA26 (from index 25 onward where EMA26 is valid)
  const macdLine = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < 25) {
      macdLine.push(0);
    } else {
      macdLine.push(ema12[i] - ema26[i]);
    }
  }

  // Signal line = 9-period EMA of MACD line (from index 25 onward)
  const macdValues = macdLine.slice(25);
  const signalLine = ema(macdValues, 9);

  if (signalLine.length === 0) return result;

  const macdVal = macdValues[macdValues.length - 1];
  const signalVal = signalLine[signalLine.length - 1];
  const histVal = macdVal - signalVal;

  result.macd = Math.round(macdVal * 1000) / 1000;
  result.signal = Math.round(signalVal * 1000) / 1000;
  result.histogram = Math.round(histVal * 1000) / 1000;
  result.label = histVal >= 0 ? 'Bullish' : 'Bearish';

  return result;
}

/**
 * Analyze volume trend: compare recent 10-day avg to 50-day avg.
 * @param {Array<{v: number}>} data - Price history with volume
 * @returns {{ ratio: number|null, label: 'Above Average' | 'Below Average' | 'Normal' }}
 */
export function volumeTrend(data) {
  const result = { ratio: null, label: 'Normal' };

  if (!data || data.length < 50) return result;

  const volumes = data.map(d => d.v).filter(v => v != null && v > 0);
  if (volumes.length < 50) return result;

  const recent10 = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10;
  const avg50 = volumes.slice(-50).reduce((a, b) => a + b, 0) / 50;

  if (avg50 === 0) return result;

  const ratio = Math.round((recent10 / avg50) * 100) / 100;
  result.ratio = ratio;

  if (ratio > 1.2) {
    result.label = 'Above Average';
  } else if (ratio < 0.8) {
    result.label = 'Below Average';
  } else {
    result.label = 'Normal';
  }

  return result;
}

/**
 * Calculate price position within 52-week range as a percentage (0-100).
 * @param {number} price - Current price
 * @param {number} yearHigh - 52-week high
 * @param {number} yearLow - 52-week low
 * @returns {number} Percentage 0-100
 */
export function pricePosition(price, yearHigh, yearLow) {
  if (price == null || yearHigh == null || yearLow == null) return 50;
  if (yearHigh === yearLow) return 50;

  const pct = ((price - yearLow) / (yearHigh - yearLow)) * 100;
  return Math.min(100, Math.max(0, Math.round(pct * 100) / 100));
}
