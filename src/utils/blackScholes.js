// Standard normal cumulative distribution function using Horner's method approximation
function normCDF(x) {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

// Standard normal probability density function
function normPDF(x) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/**
 * Black-Scholes option pricing and Greeks
 * @param {number} S - Current stock price
 * @param {number} K - Strike price
 * @param {number} T - Time to expiration in years (days / 365)
 * @param {number} r - Risk-free rate as decimal (e.g. 0.0525)
 * @param {number} sigma - Implied volatility as decimal (e.g. 0.30)
 * @param {string} optionType - 'call' or 'put'
 * @returns {{ price, delta, gamma, theta, vega, rho, intrinsicValue, timeValue }}
 */
export function calculateOption(S, K, T, r, sigma, optionType) {
  if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0) {
    const intrinsic = optionType === 'call' ? Math.max(0, S - K) : Math.max(0, K - S);
    return {
      price: intrinsic,
      delta: optionType === 'call' ? (S > K ? 1 : 0) : (S < K ? -1 : 0),
      gamma: 0,
      theta: 0,
      vega: 0,
      rho: 0,
      intrinsicValue: intrinsic,
      timeValue: 0,
    };
  }

  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;

  let price, delta, rho;

  if (optionType === 'call') {
    price = S * normCDF(d1) - K * Math.exp(-r * T) * normCDF(d2);
    delta = normCDF(d1);
    rho = K * T * Math.exp(-r * T) * normCDF(d2) / 100;
  } else {
    price = K * Math.exp(-r * T) * normCDF(-d2) - S * normCDF(-d1);
    delta = normCDF(d1) - 1;
    rho = -K * T * Math.exp(-r * T) * normCDF(-d2) / 100;
  }

  const gamma = normPDF(d1) / (S * sigma * sqrtT);

  // Theta: annual, then divide by 365 for per-day value
  const thetaAnnual = optionType === 'call'
    ? (-(S * normPDF(d1) * sigma) / (2 * sqrtT) - r * K * Math.exp(-r * T) * normCDF(d2))
    : (-(S * normPDF(d1) * sigma) / (2 * sqrtT) + r * K * Math.exp(-r * T) * normCDF(-d2));
  const theta = thetaAnnual / 365;

  // Vega: per 1% move in vol
  const vega = S * normPDF(d1) * sqrtT / 100;

  const intrinsicValue = optionType === 'call'
    ? Math.max(0, S - K)
    : Math.max(0, K - S);
  const timeValue = Math.max(0, price - intrinsicValue);

  return {
    price: Math.max(0, price),
    delta: parseFloat(delta.toFixed(4)),
    gamma: parseFloat(gamma.toFixed(4)),
    theta: parseFloat(theta.toFixed(4)),
    vega: parseFloat(vega.toFixed(4)),
    rho: parseFloat(rho.toFixed(4)),
    intrinsicValue: parseFloat(intrinsicValue.toFixed(4)),
    timeValue: parseFloat(timeValue.toFixed(4)),
  };
}
