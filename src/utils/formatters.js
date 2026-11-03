export function formatPrice(num) {
  if (num == null || isNaN(num)) return '—';
  return '$' + Number(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatChange(num) {
  if (num == null || isNaN(num)) return '—';
  const n = Number(num);
  const formatted = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n >= 0 ? `+${formatted}` : `-${formatted}`;
}

export function formatPercent(num) {
  if (num == null || isNaN(num)) return '—';
  const n = Number(num);
  return n >= 0 ? `+${n.toFixed(2)}%` : `${n.toFixed(2)}%`;
}

export function formatMarketCap(num) {
  if (num == null || isNaN(num)) return '—';
  const n = Number(num);
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

export function formatVolume(num) {
  if (num == null || isNaN(num)) return '—';
  const n = Number(num);
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

// "2026-10-28" and Yahoo's UTC-midnight period dates ("2025-09-30T00:00:00.000Z") name a calendar day, not an
// instant. new Date() reads them as UTC midnight, so a US browser would show the day before: format them in UTC.
const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}(T00:00:00(\.0+)?Z)?$/;

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const opts = { year: 'numeric', month: 'short', day: 'numeric' };
  return d.toLocaleDateString('en-US', CALENDAR_DAY.test(String(dateStr)) ? { ...opts, timeZone: 'UTC' } : opts);
}

export function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return '';
  const diff = Math.floor((now - then) / 1000);
  if (diff < 0) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(then).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatLargeNumber(num) {
  if (num == null || isNaN(num)) return '—';
  const n = Number(num);
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

// The API sends dividend yield as a percentage (0.32 means 0.32%), the same unit the scorecard thresholds use.
// (Guessing "below 1 means a fraction" turned AAPL's 0.32% into 32%.)
export function formatDividendYield(value) {
  if (value == null || isNaN(value)) return '—';
  return `${Number(value).toFixed(2)}%`;
}

// ── Quote values by instrument type: a $ only belongs on dollar prices ──
const INDEX_FUTURES = /^(ES|NQ|YM|RTY|VX)=F$/;
const YIELD_SYMBOLS = new Set(['^IRX', '^FVX', '^TNX', '^TYX', '2YY=F']);

export function unitFor(symbol = '') {
  if (YIELD_SYMBOLS.has(symbol)) return 'yield';
  if (symbol.endsWith('=X')) return 'fx';
  if (symbol.startsWith('^') || INDEX_FUTURES.test(symbol)) return 'index';
  return 'usd';
}

export function formatLevel(num, decimals = 2) {
  if (num == null || isNaN(num)) return '—';
  return Number(num).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatQuoteValue(symbol, value) {
  if (value == null || isNaN(value)) return '—';
  switch (unitFor(symbol)) {
    case 'yield': return `${Number(value).toFixed(2)}%`;
    case 'fx': return Number(value).toFixed(4);
    case 'index': return formatLevel(value);
    default: return formatPrice(value);
  }
}

export function getPriceColor(change) {
  if (change == null || isNaN(change)) return 'text-text-secondary';
  return Number(change) >= 0 ? 'text-green' : 'text-red';
}
