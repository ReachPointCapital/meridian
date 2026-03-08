const { getCached, setCached } = require('./_cache');
const { FMP_KEY, FMP_BASE, ALPHA_KEY, ALPHA_BASE } = require('./_helpers');
const { yahooQuote, yahooQuotes, yahooScreener, yahooSectors } = require('./_yahoo');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// ── Heatmap constants ──
const SP500_STOCKS = [
  'AAPL','MSFT','NVDA','AMZN','GOOGL','META','BRK-B','LLY','AVGO','TSLA',
  'WMT','JPM','V','UNH','XOM','ORCL','MA','COST','HD','PG','JNJ','ABBV',
  'BAC','NFLX','KO','CRM','CVX','MRK','AMD','PEP','TMO','ACN','LIN','MCD',
  'ABT','TXN','CSCO','DHR','NKE','PM','NEE','ADBE','INTC','UNP','AMGN','T',
  'RTX','HON','GE','LOW','UPS','SPGI','CAT','ISRG','QCOM','GS','BLK','AXP',
  'DE','INTU','MS','SBUX','GILD','MDT','ADI','VRTX','REGN','MMC','PLD','CI',
  'SYK','BSX','CB','SCHW','AMAT','MO','EOG','SO','DUK','CME','ZTS','ITW',
  'NOC','EMR','AON','PNC','USB','WM','TJX','FCX','SLB','APD','COP','KLAC',
  'PANW','SNPS','CDNS','MCHP','APH','ECL','FDX','TGT','MMM','HCA','ICE','MCO',
  'WFC','BMY','LRCX','WELL','AMT','SHW','ETN','PH','ROK','DOV','ROP','FTV',
  'IDXX','BIIB','ILMN','MRNA','ZBH','BAX','EW','HOLX','ALGN','DXCM','PODD',
  'COO','RMD','STE','XRAY','HSIC','TECH','MTD','A','BIO','TFX',
  'CTLT','VTRS','PRGO','PKI','IQV','CRL','MEDP','ICLR',
  'NUE','STLD','RS','ATI','CMC','NSC','CSX','WAB','TT',
  'CARR','OTIS','JCI','LII','AOS','ALLE','GNRC','PNR','IR','XYL',
  'CHRW','EXPD','XPO','JBHT','KNX','SAIA','ODFL','LSTR',
  'LUV','DAL','UAL','AAL','ALK','BA','LMT','GD','TDG','HWM',
  'SPR','CW','HEI','TDY','AXON','LDOS','SAIC','BAH','CACI','KTOS',
  'C','TFC','COF','DFS',
  'SYF','ALLY','FITB','HBAN','RF','CFG','MTB','KEY','CMA','ZION','FHN',
  'BK','STT','NTRS','TROW','IVZ','AMG','MET','PRU','AFL','AIG',
  'TRV','ALL','PGR','HIG','CNA','WRB','RE','RNR','MKL','CINF',
  'CVS','HUM','CNC','MOH','ABC','MCK','CAH',
  'PFE','GILD',
  'MDLZ','HSY','CPB','GIS','SJM','MKC','HRL','CAG',
  'KR','SFM',
  'YUM','QSR','DPZ','WING','WEN',
  'EBAY','ETSY','W','CHWY',
  'TSCO','WSM','RH','ROST','BURL',
  'LULU','PVH','RL','VFC',
  'F','GM','TM',
  'RIVN','LCID','NIO','LI','XPEV',
  'AEP','EXC','SRE','D','PCG','EIX','XEL','PPL',
  'AWK','WEC','CMS','CNP','NI','PNW','EVRG','AES','NRG','VST',
];
const HEATMAP_BATCH_SIZE = 50;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  const { type } = req.query;

  // ── quote ──
  if (type === 'quote') {
    const { symbol } = req.query;
    if (!symbol) return res.status(400).json({ error: 'symbol required' });
    const isMulti = symbol.includes(',');

    if (isMulti) {
      const symbols = symbol.split(',').map(s => s.trim()).filter(Boolean);
      const cacheKey = `quote_multi_${symbols.sort().join(',')}`;
      const cached = getCached(cacheKey);
      if (cached) { res.setHeader('X-Cache', 'HIT'); return res.json(cached); }
      try {
        const data = await yahooQuotes(symbols);
        if (data && data.length > 0) { setCached(cacheKey, data, 900); res.setHeader('X-Cache', 'MISS'); res.setHeader('X-Source', 'yahoo'); return res.json(data); }
        throw new Error('No results from Yahoo batch');
      } catch (e) { console.error('Quote Tier1 (Yahoo batch) failed:', e.message); }
      try {
        const response = await fetch(`${FMP_BASE}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${FMP_KEY}`);
        const data = await response.json();
        setCached(cacheKey, data, 900); res.setHeader('X-Cache', 'MISS'); res.setHeader('X-Source', 'fmp'); return res.json(data);
      } catch (e) { console.error('Quote Tier2 (FMP batch) failed:', e.message); }
      return res.status(500).json({ error: 'All quote sources failed' });
    }

    const cacheKey = `quote_${symbol}`;
    const cached = getCached(cacheKey);
    if (cached) { res.setHeader('X-Cache', 'HIT'); return res.json(cached); }
    try {
      const data = await yahooQuote(symbol);
      setCached(cacheKey, data, 900); res.setHeader('X-Cache', 'MISS'); res.setHeader('X-Source', 'yahoo'); return res.json(data);
    } catch (e) { console.error('Quote Tier1 (Yahoo) failed:', e.message); }
    try {
      const response = await fetch(`${FMP_BASE}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${FMP_KEY}`);
      const data = await response.json();
      setCached(cacheKey, data, 900); res.setHeader('X-Cache', 'MISS'); res.setHeader('X-Source', 'fmp'); return res.json(data);
    } catch (e) { console.error('Quote Tier2 (FMP) failed:', e.message); }
    return res.status(500).json({ error: 'All quote sources failed' });
  }

  // ── gainers ──
  if (type === 'gainers') {
    const cacheKey = 'av_gainers';
    const cached = getCached(cacheKey);
    if (cached) { res.setHeader('X-Cache', 'HIT'); return res.json(cached); }
    try {
      const data = await yahooScreener('day_gainers');
      if (!data || data.length === 0) throw new Error('Yahoo screener returned no gainers');
      setCached(cacheKey, data, 900); res.setHeader('X-Cache', 'MISS'); res.setHeader('X-Source', 'yahoo'); return res.json(data);
    } catch (e) { console.error('Gainers Tier1 (Yahoo) failed:', e.message); }
    try {
      const url = `${ALPHA_BASE}?function=TOP_GAINERS_LOSERS&apikey=${ALPHA_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      const gainers = (data.top_gainers || []).slice(0, 20).map(item => ({
        symbol: item.ticker, name: item.ticker, price: parseFloat(item.price),
        change: parseFloat(item.change_amount), changesPercentage: parseFloat((item.change_percentage || '0').replace('%', '')),
        volume: parseInt(item.volume, 10),
      }));
      if (gainers.length === 0) throw new Error('Alpha Vantage returned no gainers');
      setCached(cacheKey, gainers, 900); res.setHeader('X-Cache', 'MISS'); res.setHeader('X-Source', 'alphavantage'); return res.json(gainers);
    } catch (e) { console.error('Gainers Tier2 (AlphaVantage) failed:', e.message); }
    return res.status(500).json({ error: 'All gainers sources failed' });
  }

  // ── losers ──
  if (type === 'losers') {
    const cacheKey = 'av_losers';
    const cached = getCached(cacheKey);
    if (cached) { res.setHeader('X-Cache', 'HIT'); return res.json(cached); }
    try {
      const data = await yahooScreener('day_losers');
      if (!data || data.length === 0) throw new Error('Yahoo screener returned no losers');
      setCached(cacheKey, data, 900); res.setHeader('X-Cache', 'MISS'); res.setHeader('X-Source', 'yahoo'); return res.json(data);
    } catch (e) { console.error('Losers Tier1 (Yahoo) failed:', e.message); }
    try {
      const url = `${ALPHA_BASE}?function=TOP_GAINERS_LOSERS&apikey=${ALPHA_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      const losers = (data.top_losers || []).slice(0, 20).map(item => ({
        symbol: item.ticker, name: item.ticker, price: parseFloat(item.price),
        change: parseFloat(item.change_amount), changesPercentage: parseFloat((item.change_percentage || '0').replace('%', '')),
        volume: parseInt(item.volume, 10),
      }));
      if (losers.length === 0) throw new Error('Alpha Vantage returned no losers');
      setCached(cacheKey, losers, 900); res.setHeader('X-Cache', 'MISS'); res.setHeader('X-Source', 'alphavantage'); return res.json(losers);
    } catch (e) { console.error('Losers Tier2 (AlphaVantage) failed:', e.message); }
    return res.status(500).json({ error: 'All losers sources failed' });
  }

  // ── actives ──
  if (type === 'actives') {
    const cacheKey = 'av_actives';
    const cached = getCached(cacheKey);
    if (cached) { res.setHeader('X-Cache', 'HIT'); return res.json(cached); }
    try {
      const data = await yahooScreener('most_actives');
      if (!data || data.length === 0) throw new Error('Yahoo screener returned no actives');
      setCached(cacheKey, data, 900); res.setHeader('X-Cache', 'MISS'); res.setHeader('X-Source', 'yahoo'); return res.json(data);
    } catch (e) { console.error('Actives Tier1 (Yahoo) failed:', e.message); }
    try {
      const url = `${ALPHA_BASE}?function=TOP_GAINERS_LOSERS&apikey=${ALPHA_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      const actives = (data.most_actively_traded || []).slice(0, 20).map(item => ({
        symbol: item.ticker, name: item.ticker, price: parseFloat(item.price),
        change: parseFloat(item.change_amount), changesPercentage: parseFloat((item.change_percentage || '0').replace('%', '')),
        volume: parseInt(item.volume, 10),
      }));
      if (actives.length === 0) throw new Error('Alpha Vantage returned no actives');
      setCached(cacheKey, actives, 900); res.setHeader('X-Cache', 'MISS'); res.setHeader('X-Source', 'alphavantage'); return res.json(actives);
    } catch (e) { console.error('Actives Tier2 (AlphaVantage) failed:', e.message); }
    return res.status(500).json({ error: 'All actives sources failed' });
  }

  // ── sectors ──
  if (type === 'sectors') {
    const cacheKey = 'av_sectors';
    const cached = getCached(cacheKey);
    if (cached) { res.setHeader('X-Cache', 'HIT'); return res.json(cached); }
    try {
      const data = await yahooSectors();
      if (!data || Object.keys(data).length === 0) throw new Error('Yahoo returned no sector data');
      const sectors = Object.entries(data).map(([sector, pctStr]) => ({
        sector, changesPercentage: parseFloat((pctStr || '0').replace('%', '')), source: 'yahoo',
      }));
      setCached(cacheKey, sectors, 1800); res.setHeader('X-Cache', 'MISS'); res.setHeader('X-Source', 'yahoo'); return res.json(sectors);
    } catch (e) { console.error('Sectors Tier1 (Yahoo) failed:', e.message); }
    try {
      const url = `${ALPHA_BASE}?function=SECTOR&apikey=${ALPHA_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      const realtime = data['Rank A: Real-Time Performance'] || {};
      const sectors = Object.entries(realtime).map(([sector, pctStr]) => ({
        sector, changesPercentage: parseFloat((pctStr || '0').replace('%', '')),
      }));
      if (sectors.length === 0) throw new Error('Alpha Vantage returned no sector data');
      setCached(cacheKey, sectors, 1800); res.setHeader('X-Cache', 'MISS'); res.setHeader('X-Source', 'alphavantage'); return res.json(sectors);
    } catch (e) { console.error('Sectors Tier2 (AlphaVantage) failed:', e.message); }
    return res.status(500).json({ error: 'All sector sources failed' });
  }

  // ── heatmap ──
  if (type === 'heatmap') {
    const cacheKey = 'heatmap_data_v3';
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);
    try {
      const allResults = [];
      for (let i = 0; i < SP500_STOCKS.length; i += HEATMAP_BATCH_SIZE) {
        const batch = SP500_STOCKS.slice(i, i + HEATMAP_BATCH_SIZE);
        const results = await Promise.allSettled(batch.map(s => yahooFinance.quote(s)));
        allResults.push(...results);
      }
      const data = [];
      SP500_STOCKS.forEach((symbol, i) => {
        if (allResults[i].status === 'fulfilled' && allResults[i].value) {
          const v = allResults[i].value;
          if (v.regularMarketPrice != null && v.regularMarketChangePercent != null) {
            data.push({ symbol, name: v.longName || v.shortName || symbol, marketCap: v.marketCap || 0, price: v.regularMarketPrice, changePercent: v.regularMarketChangePercent });
          }
        }
      });
      setCached(cacheKey, data, 900);
      return res.json(data);
    } catch (e) {
      console.error('Heatmap error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(400).json({ error: 'Invalid type. Expected: quote, gainers, losers, actives, sectors, heatmap' });
};
