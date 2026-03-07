export function formatPrice(num) {
  if (num == null || isNaN(num)) return '—';
  return `$${Number(num).toFixed(2)}`;
}

export function formatChange(num) {
  if (num == null || isNaN(num)) return '—';
  const n = Number(num);
  return n >= 0 ? `+${n.toFixed(2)}` : `${n.toFixed(2)}`;
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

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
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

export function formatDividendYield(value) {
  if (value == null || isNaN(value)) return '—';
  const n = Number(value);
  // Values < 1 are likely decimals (e.g. 0.025 = 2.5%), values >= 1 are already percentages
  const pct = n < 1 ? n * 100 : n;
  return `${pct.toFixed(2)}%`;
}

export function getPriceColor(change) {
  if (change == null || isNaN(change)) return 'text-text-secondary';
  return Number(change) >= 0 ? 'text-green' : 'text-red';
}
