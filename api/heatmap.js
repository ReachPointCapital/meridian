const { getCached, setCached } = require('./_cache');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// Full S&P 500 constituents ordered by market cap weight
const SP500_STOCKS = [
  'AAPL','MSFT','NVDA','AMZN','GOOGL','GOOG','META','BRK-B','LLY','AVGO',
  'TSLA','WMT','JPM','V','UNH','XOM','ORCL','MA','COST','HD','JNJ','ABBV',
  'BAC','NFLX','KO','CRM','CVX','MRK','AMD','PEP','TMO','ACN','LIN','MCD',
  'ABT','TXN','CSCO','DHR','NKE','PM','NEE','ADBE','INTC','UNP','AMGN','T',
  'RTX','HON','GE','LOW','UPS','SPGI','CAT','ISRG','QCOM','GS','BLK','AXP',
  'DE','INTU','MS','SBUX','GILD','MDT','ADI','VRTX','REGN','MMC','PLD','CI',
  'SYK','BSX','CB','SCHW','AMAT','MO','EOG','SO','DUK','CME','ZTS','ITW',
  'NOC','EMR','AON','PNC','USB','WM','TJX','FCX','SLB','APD','COP','KLAC',
  'PANW','SNPS','CDNS','MCHP','APH','ECL','FDX','TGT','MMM','HCA','ICE','MCO',
  'WFC','BMY','LRCX','WELL','AMT','CCI','PSA','O','DLR','EQR','AVB','ARE',
  'SHW','PPG','NEM','IP','CF','MOS','FMC','ALB','BG','CTVA','DD',
  'DOW','LYB','CE','EMN','HUN','RPM','SEE','SON','WRK','PKG','GPK','ATR',
  'AOS','PH','ROK','SWK','SNA','GWW','FAST','GPC','WSO','WAB','TT',
  'OTIS','CARR','JCI','CSX','NSC','R','CHRW','EXPD','XPO','JBHT',
  'LUV','DAL','UAL','AAL','ALK','BA','LMT','GD',
  'TDG','HWM','SPR','CW','HEI','TDY','AXON','LDOS',
  'SAIC','BAH','CACI',
  'C','TFC','COF','DFS',
  'SYF','ALLY','FITB','HBAN','RF','CFG','MTB','KEY','CMA','ZION','FHN',
  'BK','STT','NTRS','TROW','IVZ',
  'MET','PRU','AFL','AIG','TRV','ALL','PGR','HIG','CNA','WRB',
  'RE','RNR','MKL','CINF','GL','LNC','PFG','VOYA',
  'CVS','HUM','CNC','MOH','ABC','MCK','CAH','HSIC',
  'A','BIO','TFX','HOLX',
  'ALGN','DXCM','PODD','INSP',
];

const BATCH_SIZE = 50;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const cacheKey = 'heatmap_data_v2';
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    // Batch fetch to avoid overwhelming Yahoo
    const allResults = [];
    for (let i = 0; i < SP500_STOCKS.length; i += BATCH_SIZE) {
      const batch = SP500_STOCKS.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(s => yahooFinance.quote(s))
      );
      allResults.push(...results);
    }

    const data = SP500_STOCKS.map((symbol, i) => ({
      symbol,
      name: allResults[i].status === 'fulfilled' ? (allResults[i].value?.longName || allResults[i].value?.shortName || symbol) : symbol,
      marketCap: allResults[i].status === 'fulfilled' ? (allResults[i].value?.marketCap || 0) : 0,
      price: allResults[i].status === 'fulfilled' ? allResults[i].value?.regularMarketPrice ?? null : null,
      changePercent: allResults[i].status === 'fulfilled' ? allResults[i].value?.regularMarketChangePercent ?? null : null,
    }));

    setCached(cacheKey, data, 900);
    return res.json(data);
  } catch (e) {
    console.error('Heatmap error:', e.message);
    res.status(500).json({ error: e.message });
  }
};
