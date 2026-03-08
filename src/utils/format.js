// Format large numbers with B/M suffix AND commas
export const formatLarge = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '—';
  const n = Number(val);
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e12) return sign + '$' + (abs / 1e12).toFixed(2) + 'T';
  if (abs >= 1e9) return sign + '$' + (abs / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return sign + '$' + (abs / 1e6).toFixed(1) + 'M';
  if (abs >= 1e3) return sign + '$' + abs.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return sign + '$' + abs.toFixed(2);
};

// Format large numbers WITHOUT $ prefix (for axis labels, etc.)
export const formatLargeRaw = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '—';
  const n = Number(val);
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e12) return sign + (abs / 1e12).toFixed(2) + 'T';
  if (abs >= 1e9) return sign + (abs / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return sign + (abs / 1e6).toFixed(1) + 'M';
  if (abs >= 1e3) return sign + abs.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return sign + abs.toFixed(2);
};

// Format a plain number with commas (no $ sign)
export const formatNumber = (val, decimals = 0) => {
  if (val === null || val === undefined || isNaN(val)) return '—';
  return Number(val).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

// Format a dollar value with commas, fixed decimals
export const formatDollar = (val, decimals = 2) => {
  if (val === null || val === undefined || isNaN(val)) return '—';
  const n = Number(val);
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  return sign + '$' + abs.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

// Format percentage
export const formatPct = (val, decimals = 1) => {
  if (val === null || val === undefined || isNaN(val)) return '—';
  return Number(val).toFixed(decimals) + '%';
};

// Format share price (always 2 decimals, commas if needed)
export const formatPrice = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '—';
  return '$' + Number(val).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Format per-share values (EPS, book value etc)
export const formatPerShare = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '—';
  const n = Number(val);
  const sign = n < 0 ? '-' : '';
  return sign + '$' + Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Format volume/shares outstanding with commas
export const formatShares = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '—';
  const n = Number(val);
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return String(Math.round(n));
};

// Format a multiple/ratio like P/E, EV/EBITDA (e.g. "12.3x")
export const formatMultiple = (val, decimals = 1) => {
  if (val === null || val === undefined || isNaN(val)) return '—';
  return Number(val).toFixed(decimals) + 'x';
};
