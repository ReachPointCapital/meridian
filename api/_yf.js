// One shared Yahoo Finance client for every serverless function.
//
// Yahoo changes its response shapes without notice. yahoo-finance2 then throws FailedYahooValidationError,
// which used to blank search, news and the movers lists until the library caught up. That error still
// carries the parsed response, so we log the drift and carry on with the data instead of failing the feature.
const YahooFinance = require('yahoo-finance2').default;

const WRAPPED = new Set([
  'quote', 'quoteSummary', 'chart', 'search', 'screener', 'fundamentalsTimeSeries',
  'historical', 'options', 'trendingSymbols', 'insights', 'recommendationsBySymbol',
]);

async function tolerant(call, label = 'call') {
  try {
    return await call();
  } catch (err) {
    if (err && err.name === 'FailedYahooValidationError' && err.result != null) {
      const first = (err.errors || []).slice(0, 2).map((e) => `${e.instancePath || '/'} ${e.message}`).join('; ');
      console.warn(`[yahoo] schema drift tolerated in ${label}: ${first}`);
      return err.result;
    }
    throw err;
  }
}

function createTolerantClient(client) {
  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function' || !WRAPPED.has(prop)) return value;
      return (...args) => tolerant(() => value.apply(target, args), String(prop));
    },
  });
}

const yf = createTolerantClient(new YahooFinance({
  suppressNotices: ['yahooSurvey'],
  validation: { logErrors: false },
}));

module.exports = { yf, tolerant, createTolerantClient };
