import { api } from './api';

export async function getPriceHistory(ticker, timeframe) {
  const data = await api.chart(ticker, timeframe);
  return Array.isArray(data) ? data : [];
}
