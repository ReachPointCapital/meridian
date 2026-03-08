const { getCached, setCached } = require('./_cache');
const { FMP_KEY, FMP_BASE } = require('./_helpers');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const cacheKey = 'insider_trading_feed';
  const cached = getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  const mapTrade = (t) => ({
    symbol: t.symbol,
    owner: t.reportingName || t.reportingCik || 'Unknown',
    transactionType: t.transactionType || 'N/A',
    shares: t.securitiesTransacted,
    price: t.price,
    value: (t.securitiesTransacted || 0) * (t.price || 0),
    date: t.filingDate || t.transactionDate,
  });

  // Option A: v4 insider-trading with transactionType filter
  try {
    const url = `https://financialmodelingprep.com/api/v4/insider-trading?transactionType=P-Purchase,S-Sale&limit=20&apikey=${FMP_KEY}`;
    console.log('[InsiderFeed] Option A:', url);
    const response = await fetch(url);
    console.log('[InsiderFeed] Option A status:', response.status);
    if (response.status === 401 || response.status === 403) {
      console.error('[InsiderFeed] FMP auth error on Option A');
    }
    const data = await response.json();
    console.log('[InsiderFeed] Option A raw:', JSON.stringify(data).substring(0, 500));
    if (Array.isArray(data) && data.length > 0) {
      const mapped = data.slice(0, 20).map(mapTrade);
      setCached(cacheKey, mapped, 1800);
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Source', 'fmp-v4-feed');
      return res.json(mapped);
    }
  } catch (e) {
    console.error('[InsiderFeed] Option A failed:', e.message);
  }

  // Option B: Per-symbol fetch for top 10 tickers using stable API (known working pattern)
  const TOP_SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'JPM', 'V', 'UNH'];
  try {
    console.log('[InsiderFeed] Option B: fetching per-symbol for', TOP_SYMBOLS.join(','));
    const results = await Promise.allSettled(
      TOP_SYMBOLS.map(async (sym) => {
        const url = `${FMP_BASE}/insider-trading?symbol=${sym}&limit=3&apikey=${FMP_KEY}`;
        const r = await fetch(url);
        if (r.status === 401 || r.status === 403) {
          console.error(`[InsiderFeed] FMP auth error for ${sym}`);
          return [];
        }
        const d = await r.json();
        console.log(`[InsiderFeed] Option B ${sym}: ${Array.isArray(d) ? d.length : 'not array'} results`);
        return Array.isArray(d) ? d : [];
      })
    );
    const allTrades = [];
    results.forEach(r => {
      if (r.status === 'fulfilled') allTrades.push(...r.value);
    });
    console.log(`[InsiderFeed] Option B total trades: ${allTrades.length}`);
    if (allTrades.length > 0) {
      allTrades.sort((a, b) => new Date(b.filingDate || b.transactionDate || 0) - new Date(a.filingDate || a.transactionDate || 0));
      const mapped = allTrades.slice(0, 15).map(mapTrade);
      setCached(cacheKey, mapped, 1800);
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Source', 'fmp-per-symbol');
      return res.json(mapped);
    }
  } catch (e) {
    console.error('[InsiderFeed] Option B failed:', e.message);
  }

  // Option C: SEC EDGAR RSS feed for recent Form 4 filings (completely free)
  try {
    console.log('[InsiderFeed] Option C: SEC EDGAR RSS');
    const rss = await fetch(
      'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4&dateb=&owner=include&count=30&search_text=&output=atom',
      { headers: { 'User-Agent': 'Meridian/1.0 info@reachpointcapital.com' } }
    );
    const rssText = await rss.text();
    const entries = [];
    const titleMatches = [...rssText.matchAll(/<title[^>]*>([^<]+)<\/title>/g)].slice(1);
    const dateMatches = [...rssText.matchAll(/<updated>([^<]+)<\/updated>/g)].slice(1);

    for (let i = 0; i < Math.min(titleMatches.length, 15); i++) {
      const titleText = titleMatches[i]?.[1] || '';
      // Format: "4 - COMPANY NAME (FILER)"
      const cleaned = titleText.replace(/^4\s*-\s*/, '');
      const parts = cleaned.split(/\s*\(([^)]+)\)\s*/);
      const company = parts[0]?.trim() || cleaned;
      const filer = parts[1]?.trim() || '';
      const dateStr = dateMatches[i]?.[1];
      const date = dateStr ? new Date(dateStr) : null;
      entries.push({
        symbol: filer.match(/^[A-Z]{1,5}$/) ? filer : '',
        owner: filer || company,
        transactionType: 'Form 4',
        shares: null,
        price: null,
        value: null,
        date: date ? date.toISOString().split('T')[0] : '',
      });
    }
    console.log(`[InsiderFeed] Option C: ${entries.length} SEC filings parsed`);
    if (entries.length > 0) {
      setCached(cacheKey, entries, 1800);
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Source', 'sec-edgar-rss');
      return res.json(entries);
    }
  } catch (e) {
    console.error('[InsiderFeed] Option C (SEC EDGAR) failed:', e.message);
  }

  // Option D: SEC EDGAR full-text search for Form 4 filings
  try {
    console.log('[InsiderFeed] Option D: SEC EDGAR EFTS search');
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const response = await fetch(
      `https://efts.sec.gov/LATEST/search-index?q=%224%22&dateRange=custom&startdt=${weekAgo}&enddt=${today}&forms=4`,
      { headers: { 'User-Agent': 'Meridian/1.0 info@reachpointcapital.com' } }
    );
    const data = await response.json();
    const hits = (data.hits?.hits || []).slice(0, 15);
    if (hits.length > 0) {
      const mapped = hits.map(hit => ({
        symbol: '',
        owner: hit._source?.display_names?.[0] || 'Unknown',
        transactionType: 'Form 4',
        shares: null,
        price: null,
        value: null,
        date: hit._source?.file_date || '',
      }));
      setCached(cacheKey, mapped, 1800);
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Source', 'sec-edgar-efts');
      return res.json(mapped);
    }
  } catch (e) {
    console.error('[InsiderFeed] Option D (SEC EFTS) failed:', e.message);
  }

  console.log('[InsiderFeed] All options exhausted, returning empty');
  res.json([]);
};
