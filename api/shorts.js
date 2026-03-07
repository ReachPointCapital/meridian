const { getCached, setCached } = require('./_cache');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const SCREENER_IDS = ['most_shorted_stocks', 'short_squeeze_stocks', 'aggressive_small_caps'];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const cacheKey = 'most_shorted';
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  // Tier 1: Try multiple Yahoo screener IDs
  for (const scrId of SCREENER_IDS) {
    try {
      const result = await yahooFinance.screener({ scrIds: scrId, count: 20 });
      const quotes = result.quotes || [];
      if (quotes.length > 0) {
        const data = quotes.map(q => ({
          ticker: q.symbol,
          name: q.longName || q.shortName || q.symbol,
          price: q.regularMarketPrice,
          changePercent: q.regularMarketChangePercent,
          shortPercentOfFloat: q.shortPercentOfFloat ?? null,
          shortRatio: q.shortRatio ?? null,
        }));
        setCached(cacheKey, data, 3600);
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('X-Source', `yahoo-${scrId}`);
        return res.json(data);
      }
    } catch (e) {
      console.error(`Shorts screener "${scrId}" failed:`, e.message);
    }
  }

  // Tier 2: Get most actives and enrich with short data
  try {
    const result = await yahooFinance.screener({ scrIds: 'most_actives', count: 25 });
    const quotes = result.quotes || [];
    if (quotes.length > 0) {
      const enriched = await Promise.allSettled(
        quotes.slice(0, 20).map(async (q) => {
          try {
            const summary = await yahooFinance.quoteSummary(q.symbol, { modules: ['defaultKeyStatistics', 'price'] });
            const stats = summary.defaultKeyStatistics || {};
            const spf = stats.shortPercentOfFloat?.raw ?? stats.shortPercentOfFloat ?? null;
            const sr = stats.shortRatio?.raw ?? stats.shortRatio ?? null;
            return {
              ticker: q.symbol,
              name: q.longName || q.shortName || q.symbol,
              price: q.regularMarketPrice,
              changePercent: q.regularMarketChangePercent,
              shortPercentOfFloat: spf,
              shortRatio: sr,
            };
          } catch {
            return {
              ticker: q.symbol,
              name: q.longName || q.shortName || q.symbol,
              price: q.regularMarketPrice,
              changePercent: q.regularMarketChangePercent,
              shortPercentOfFloat: null,
              shortRatio: null,
            };
          }
        })
      );

      const data = enriched
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value)
        .filter(d => d.ticker)
        .sort((a, b) => (b.shortPercentOfFloat || 0) - (a.shortPercentOfFloat || 0));

      if (data.length > 0) {
        setCached(cacheKey, data, 3600);
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('X-Source', 'yahoo-actives-enriched');
        return res.json(data);
      }
    }
  } catch (e) {
    console.error('Shorts actives enrichment failed:', e.message);
  }

  res.json({ data: [], message: 'Short interest data temporarily unavailable' });
};
