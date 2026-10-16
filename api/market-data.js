const { getCached, setCached } = require('./_cache');
const { yahooCrypto, getQuoteMap } = require('./_yahoo');
const { COMMODITIES, FOREX_PAIRS, INDICES, buildCommodities, buildForex, buildIndices } = require('./_marketData');
const { withApi } = require('./_api');

const symbolsOf = (list) => list.map((item) => item.symbol);

// One batched Yahoo request per type. TTLs are seconds, used both in memory and as the CDN s-maxage.
const TYPES = new Map([
  ['commodities', {
    ttl: 120,
    load: async () => {
      const rows = buildCommodities(await getQuoteMap(symbolsOf(COMMODITIES)));
      if (rows.length === 0) throw new Error('Yahoo returned no commodity quotes');
      return rows;
    },
  }],
  ['crypto', {
    ttl: 60,
    load: async () => {
      const rows = await yahooCrypto();
      if (!rows || rows.length === 0) throw new Error('Yahoo returned no crypto quotes');
      return rows;
    },
  }],
  ['forex', {
    ttl: 120,
    load: async () => {
      const rows = buildForex(await getQuoteMap(symbolsOf(FOREX_PAIRS)));
      if (rows.every((r) => r.rate === null)) throw new Error('Yahoo returned no forex quotes');
      return rows;
    },
  }],
  ['globalindices', {
    ttl: 120,
    load: async () => {
      const rows = buildIndices(await getQuoteMap(symbolsOf(INDICES)));
      if (rows.every((r) => r.price === null)) throw new Error('Yahoo returned no index quotes');
      return rows;
    },
  }],
]);

async function handler(req, res) {
  const { type } = req.query;
  const spec = TYPES.get(type);
  if (!spec) return res.status(400).json({ error: `Invalid type. Expected: ${[...TYPES.keys()].join(', ')}` });

  const cacheKey = `market_data_${type}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }
  const data = await spec.load();
  setCached(cacheKey, data, spec.ttl);
  res.setHeader('X-Cache', 'MISS');
  return res.json(data);
}

module.exports = withApi(handler, {
  name: 'market-data',
  cache: (query) => {
    const spec = TYPES.get(query.type);
    return spec ? { sMaxAge: spec.ttl, swr: spec.ttl * 5 } : null;
  },
});
