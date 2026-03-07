const { getCached, setCached } = require('./_cache');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const SP500_STOCKS = [
  // Technology
  { symbol: 'AAPL', name: 'Apple', sector: 'Technology', marketCap: 2800 },
  { symbol: 'MSFT', name: 'Microsoft', sector: 'Technology', marketCap: 2600 },
  { symbol: 'NVDA', name: 'NVIDIA', sector: 'Technology', marketCap: 1800 },
  { symbol: 'GOOGL', name: 'Alphabet', sector: 'Technology', marketCap: 1700 },
  { symbol: 'META', name: 'Meta', sector: 'Technology', marketCap: 1200 },
  { symbol: 'AVGO', name: 'Broadcom', sector: 'Technology', marketCap: 580 },
  { symbol: 'ORCL', name: 'Oracle', sector: 'Technology', marketCap: 350 },
  { symbol: 'CRM', name: 'Salesforce', sector: 'Technology', marketCap: 280 },
  { symbol: 'AMD', name: 'AMD', sector: 'Technology', marketCap: 250 },
  { symbol: 'INTC', name: 'Intel', sector: 'Technology', marketCap: 180 },
  { symbol: 'ADBE', name: 'Adobe', sector: 'Technology', marketCap: 200 },
  { symbol: 'QCOM', name: 'Qualcomm', sector: 'Technology', marketCap: 190 },
  { symbol: 'TXN', name: 'Texas Instruments', sector: 'Technology', marketCap: 160 },
  { symbol: 'NOW', name: 'ServiceNow', sector: 'Technology', marketCap: 190 },
  { symbol: 'INTU', name: 'Intuit', sector: 'Technology', marketCap: 170 },
  // Consumer Discretionary
  { symbol: 'AMZN', name: 'Amazon', sector: 'Consumer Discretionary', marketCap: 1800 },
  { symbol: 'TSLA', name: 'Tesla', sector: 'Consumer Discretionary', marketCap: 800 },
  { symbol: 'HD', name: 'Home Depot', sector: 'Consumer Discretionary', marketCap: 350 },
  { symbol: 'MCD', name: "McDonald's", sector: 'Consumer Discretionary', marketCap: 210 },
  { symbol: 'NKE', name: 'Nike', sector: 'Consumer Discretionary', marketCap: 130 },
  { symbol: 'SBUX', name: 'Starbucks', sector: 'Consumer Discretionary', marketCap: 110 },
  { symbol: 'TJX', name: 'TJX', sector: 'Consumer Discretionary', marketCap: 120 },
  { symbol: 'LOW', name: "Lowe's", sector: 'Consumer Discretionary', marketCap: 140 },
  { symbol: 'BKNG', name: 'Booking', sector: 'Consumer Discretionary', marketCap: 130 },
  // Financials
  { symbol: 'BRK-B', name: 'Berkshire', sector: 'Financials', marketCap: 780 },
  { symbol: 'JPM', name: 'JPMorgan', sector: 'Financials', marketCap: 550 },
  { symbol: 'V', name: 'Visa', sector: 'Financials', marketCap: 480 },
  { symbol: 'MA', name: 'Mastercard', sector: 'Financials', marketCap: 420 },
  { symbol: 'BAC', name: 'Bank of America', sector: 'Financials', marketCap: 290 },
  { symbol: 'WFC', name: 'Wells Fargo', sector: 'Financials', marketCap: 230 },
  { symbol: 'GS', name: 'Goldman Sachs', sector: 'Financials', marketCap: 180 },
  { symbol: 'MS', name: 'Morgan Stanley', sector: 'Financials', marketCap: 160 },
  { symbol: 'SPGI', name: 'S&P Global', sector: 'Financials', marketCap: 140 },
  { symbol: 'AXP', name: 'Amex', sector: 'Financials', marketCap: 170 },
  // Healthcare
  { symbol: 'LLY', name: 'Eli Lilly', sector: 'Healthcare', marketCap: 700 },
  { symbol: 'UNH', name: 'UnitedHealth', sector: 'Healthcare', marketCap: 480 },
  { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', marketCap: 380 },
  { symbol: 'ABBV', name: 'AbbVie', sector: 'Healthcare', marketCap: 290 },
  { symbol: 'MRK', name: 'Merck', sector: 'Healthcare', marketCap: 260 },
  { symbol: 'TMO', name: 'Thermo Fisher', sector: 'Healthcare', marketCap: 200 },
  { symbol: 'ABT', name: 'Abbott', sector: 'Healthcare', marketCap: 190 },
  { symbol: 'DHR', name: 'Danaher', sector: 'Healthcare', marketCap: 180 },
  { symbol: 'PFE', name: 'Pfizer', sector: 'Healthcare', marketCap: 160 },
  { symbol: 'AMGN', name: 'Amgen', sector: 'Healthcare', marketCap: 150 },
  // Communication Services
  { symbol: 'NFLX', name: 'Netflix', sector: 'Communication Services', marketCap: 280 },
  { symbol: 'DIS', name: 'Disney', sector: 'Communication Services', marketCap: 200 },
  { symbol: 'CMCSA', name: 'Comcast', sector: 'Communication Services', marketCap: 160 },
  { symbol: 'T', name: 'AT&T', sector: 'Communication Services', marketCap: 130 },
  { symbol: 'VZ', name: 'Verizon', sector: 'Communication Services', marketCap: 120 },
  { symbol: 'TMUS', name: 'T-Mobile', sector: 'Communication Services', marketCap: 200 },
  // Industrials
  { symbol: 'CAT', name: 'Caterpillar', sector: 'Industrials', marketCap: 180 },
  { symbol: 'RTX', name: 'RTX Corp', sector: 'Industrials', marketCap: 160 },
  { symbol: 'HON', name: 'Honeywell', sector: 'Industrials', marketCap: 140 },
  { symbol: 'UNP', name: 'Union Pacific', sector: 'Industrials', marketCap: 140 },
  { symbol: 'GE', name: 'GE', sector: 'Industrials', marketCap: 180 },
  { symbol: 'BA', name: 'Boeing', sector: 'Industrials', marketCap: 120 },
  { symbol: 'LMT', name: 'Lockheed', sector: 'Industrials', marketCap: 120 },
  { symbol: 'DE', name: 'Deere', sector: 'Industrials', marketCap: 110 },
  // Consumer Staples
  { symbol: 'WMT', name: 'Walmart', sector: 'Consumer Staples', marketCap: 500 },
  { symbol: 'PG', name: 'Procter & Gamble', sector: 'Consumer Staples', marketCap: 360 },
  { symbol: 'COST', name: 'Costco', sector: 'Consumer Staples', marketCap: 320 },
  { symbol: 'KO', name: 'Coca-Cola', sector: 'Consumer Staples', marketCap: 260 },
  { symbol: 'PEP', name: 'PepsiCo', sector: 'Consumer Staples', marketCap: 220 },
  { symbol: 'PM', name: 'Philip Morris', sector: 'Consumer Staples', marketCap: 170 },
  { symbol: 'MDLZ', name: 'Mondelez', sector: 'Consumer Staples', marketCap: 90 },
  // Energy
  { symbol: 'XOM', name: 'ExxonMobil', sector: 'Energy', marketCap: 460 },
  { symbol: 'CVX', name: 'Chevron', sector: 'Energy', marketCap: 280 },
  { symbol: 'COP', name: 'ConocoPhillips', sector: 'Energy', marketCap: 130 },
  { symbol: 'SLB', name: 'SLB', sector: 'Energy', marketCap: 70 },
  { symbol: 'EOG', name: 'EOG Resources', sector: 'Energy', marketCap: 70 },
  // Utilities
  { symbol: 'NEE', name: 'NextEra', sector: 'Utilities', marketCap: 140 },
  { symbol: 'SO', name: 'Southern Co', sector: 'Utilities', marketCap: 80 },
  { symbol: 'DUK', name: 'Duke Energy', sector: 'Utilities', marketCap: 80 },
  // Real Estate
  { symbol: 'PLD', name: 'Prologis', sector: 'Real Estate', marketCap: 100 },
  { symbol: 'AMT', name: 'American Tower', sector: 'Real Estate', marketCap: 90 },
  { symbol: 'EQIX', name: 'Equinix', sector: 'Real Estate', marketCap: 80 },
  // Materials
  { symbol: 'LIN', name: 'Linde', sector: 'Materials', marketCap: 200 },
  { symbol: 'SHW', name: 'Sherwin-Williams', sector: 'Materials', marketCap: 90 },
  { symbol: 'FCX', name: 'Freeport', sector: 'Materials', marketCap: 70 },
];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const cacheKey = 'heatmap_data';
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const results = await Promise.allSettled(
      SP500_STOCKS.map(s => yahooFinance.quote(s.symbol))
    );

    const data = SP500_STOCKS.map((stock, i) => ({
      symbol: stock.symbol,
      name: stock.name,
      sector: stock.sector,
      marketCap: stock.marketCap,
      price: results[i].status === 'fulfilled' ? results[i].value?.regularMarketPrice ?? null : null,
      changePercent: results[i].status === 'fulfilled' ? results[i].value?.regularMarketChangePercent ?? null : null,
      volume: results[i].status === 'fulfilled' ? results[i].value?.regularMarketVolume ?? null : null,
    }));

    setCached(cacheKey, data, 900);
    return res.json(data);
  } catch (e) {
    console.error('Heatmap error:', e.message);
    res.status(500).json({ error: e.message });
  }
};
