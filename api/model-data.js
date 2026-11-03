// Peer companies for a ticker (Models page). The old version fetched seven FMP /api/v3 and /api/v4 endpoints that FMP
// has since retired and returned empty objects; the page only ever read the peers, which now come from Yahoo.
const { getCached, setCached } = require('./_cache');
const { yf: yahooFinance } = require('./_yf');
const { buildPeers } = require('./_peers');
const { withApi } = require('./_api');

async function handler(req, res) {
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  const cacheKey = `peers_${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  const output = buildPeers(symbol, await yahooFinance.recommendationsBySymbol(symbol));
  setCached(cacheKey, output, 86400);
  res.setHeader('X-Cache', 'MISS');
  return res.json(output);
}

module.exports = withApi(handler, { name: 'model-data', cache: () => ({ sMaxAge: 86400, swr: 86400 }) });
