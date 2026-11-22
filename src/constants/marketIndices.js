// The four headline US indices, as the index levels themselves. Not the SPY/QQQ/DIA/IWM funds: a fund's price is about a
// tenth of its index, so showing one under an index name reads as wrong. The home tiles, the sidebar and the dashboard all
// read this list. api/_marketData.js (MACRO_INSTRUMENTS) names the same four, and test/macroInstruments.test.js checks they agree.
export const MAIN_INDICES = [
  { symbol: '^GSPC', label: 'S&P 500', color: '#E5B94E' },
  { symbol: '^NDX', label: 'NASDAQ 100', color: '#3B82F6' },
  { symbol: '^DJI', label: 'Dow Jones', color: '#2EE6A6' },
  { symbol: '^RUT', label: 'Russell 2000', color: '#A855F7' },
];
