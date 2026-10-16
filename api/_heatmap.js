// The market heatmap (api/market.js ?type=heatmap). See test/heatmap.test.js.
// Fetched with batched quote requests: the old code made ~290 separate calls in sequential groups and took ~8 s cold,
// close to Vercel's 10 s limit; three batched calls take about 1 s.
const { getQuotes } = require('./_yahoo');

// Large US stocks. Renamed tickers are updated (MMC->MRSH, BK->BNY, RE->EG, ABC->COR, PKI->RVTY); names that were
// acquired or delisted (HOLX, CTLT, SPR, DFS, CMA) and foreign or non-index names (TM, NIO, LI, XPEV, RIVN, LCID, W,
// CHWY) are gone. Membership of the actual S&P 500 index changes over time and needs an index data source to track.
const HEATMAP_SYMBOLS = [
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'BRK-B', 'LLY', 'AVGO', 'TSLA', 'WMT', 'JPM',
  'V', 'UNH', 'XOM', 'ORCL', 'MA', 'COST', 'HD', 'PG', 'JNJ', 'ABBV', 'BAC', 'NFLX',
  'KO', 'CRM', 'CVX', 'MRK', 'AMD', 'PEP', 'TMO', 'ACN', 'LIN', 'MCD', 'ABT', 'TXN',
  'CSCO', 'DHR', 'NKE', 'PM', 'NEE', 'ADBE', 'INTC', 'UNP', 'AMGN', 'T', 'RTX', 'HON',
  'GE', 'LOW', 'UPS', 'SPGI', 'CAT', 'ISRG', 'QCOM', 'GS', 'BLK', 'AXP', 'DE', 'INTU',
  'MS', 'SBUX', 'GILD', 'MDT', 'ADI', 'VRTX', 'REGN', 'PLD', 'CI', 'SYK', 'BSX', 'CB',
  'SCHW', 'AMAT', 'MO', 'EOG', 'SO', 'DUK', 'CME', 'ZTS', 'ITW', 'NOC', 'EMR', 'AON',
  'PNC', 'USB', 'WM', 'TJX', 'FCX', 'SLB', 'APD', 'COP', 'KLAC', 'PANW', 'SNPS', 'CDNS',
  'MCHP', 'APH', 'ECL', 'FDX', 'TGT', 'MMM', 'HCA', 'ICE', 'MCO', 'WFC', 'BMY', 'LRCX',
  'WELL', 'AMT', 'SHW', 'ETN', 'PH', 'ROK', 'DOV', 'ROP', 'FTV', 'IDXX', 'BIIB', 'ILMN',
  'MRNA', 'ZBH', 'BAX', 'EW', 'ALGN', 'DXCM', 'PODD', 'COO', 'RMD', 'STE', 'XRAY', 'HSIC',
  'TECH', 'MTD', 'A', 'BIO', 'TFX', 'VTRS', 'PRGO', 'IQV', 'CRL', 'MEDP', 'ICLR', 'NUE',
  'STLD', 'RS', 'ATI', 'CMC', 'NSC', 'CSX', 'WAB', 'TT', 'CARR', 'OTIS', 'JCI', 'LII',
  'AOS', 'ALLE', 'GNRC', 'PNR', 'IR', 'XYL', 'CHRW', 'EXPD', 'XPO', 'JBHT', 'KNX', 'SAIA',
  'ODFL', 'LSTR', 'LUV', 'DAL', 'UAL', 'AAL', 'ALK', 'BA', 'LMT', 'GD', 'TDG', 'HWM',
  'CW', 'HEI', 'TDY', 'AXON', 'LDOS', 'SAIC', 'BAH', 'CACI', 'KTOS', 'C', 'TFC', 'COF',
  'SYF', 'ALLY', 'FITB', 'HBAN', 'RF', 'CFG', 'MTB', 'KEY', 'ZION', 'FHN', 'STT', 'NTRS',
  'TROW', 'IVZ', 'AMG', 'MET', 'PRU', 'AFL', 'AIG', 'TRV', 'ALL', 'PGR', 'HIG', 'CNA',
  'WRB', 'RNR', 'MKL', 'CINF', 'CVS', 'HUM', 'CNC', 'MOH', 'MCK', 'CAH', 'PFE', 'MDLZ',
  'HSY', 'CPB', 'GIS', 'SJM', 'MKC', 'HRL', 'CAG', 'KR', 'SFM', 'YUM', 'QSR', 'DPZ',
  'WING', 'WEN', 'EBAY', 'ETSY', 'TSCO', 'WSM', 'RH', 'ROST', 'BURL', 'LULU', 'PVH', 'RL',
  'VFC', 'F', 'GM', 'AEP', 'EXC', 'SRE', 'D', 'PCG', 'EIX', 'XEL', 'PPL', 'AWK',
  'WEC', 'CMS', 'CNP', 'NI', 'PNW', 'EVRG', 'AES', 'NRG', 'VST', 'MRSH', 'BNY', 'EG',
  'COR', 'RVTY',
];

// Usable quotes only (price and day change present), largest first.
function buildHeatmap(quotes) {
  return quotes
    .filter((q) => q && q.regularMarketPrice != null && q.regularMarketChangePercent != null)
    .map((q) => ({
      symbol: q.symbol,
      name: q.longName || q.shortName || q.symbol,
      marketCap: q.marketCap || 0,
      price: q.regularMarketPrice,
      changePercent: q.regularMarketChangePercent,
    }))
    .sort((a, b) => b.marketCap - a.marketCap || a.symbol.localeCompare(b.symbol));
}

async function fetchHeatmap(opts = {}) {
  return buildHeatmap(await getQuotes(HEATMAP_SYMBOLS, { chunk: 100, ...opts }));
}

module.exports = { HEATMAP_SYMBOLS, buildHeatmap, fetchHeatmap };
