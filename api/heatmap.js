const { getCached, setCached } = require('./_cache');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

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

const BATCH_SIZE = 50;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const cacheKey = 'heatmap_data_v3';
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const allResults = [];
    for (let i = 0; i < SP500_STOCKS.length; i += BATCH_SIZE) {
      const batch = SP500_STOCKS.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(s => yahooFinance.quote(s))
      );
      allResults.push(...results);
    }

    const data = [];
    SP500_STOCKS.forEach((symbol, i) => {
      if (allResults[i].status === 'fulfilled' && allResults[i].value) {
        const v = allResults[i].value;
        if (v.regularMarketPrice != null && v.regularMarketChangePercent != null) {
          data.push({
            symbol,
            name: v.longName || v.shortName || symbol,
            marketCap: v.marketCap || 0,
            price: v.regularMarketPrice,
            changePercent: v.regularMarketChangePercent,
          });
        }
      }
    });

    setCached(cacheKey, data, 900);
    return res.json(data);
  } catch (e) {
    console.error('Heatmap error:', e.message);
    res.status(500).json({ error: e.message });
  }
};
