import { api } from './api';

export async function getQuote(symbol) {
  const data = await api.quote(symbol);
  return Array.isArray(data) ? data[0] : data;
}

export async function getProfile(symbol) {
  const data = await api.profile(symbol);
  return Array.isArray(data) ? data[0] : data;
}

export async function getIncomeStatement(symbol, period = 'annual', limit = 5) {
  return await api.financials(symbol, 'income', period);
}

export async function getBalanceSheet(symbol, period = 'annual', limit = 5) {
  return await api.financials(symbol, 'balance', period);
}

export async function getCashFlow(symbol, period = 'annual', limit = 5) {
  return await api.financials(symbol, 'cashflow', period);
}

export async function getEarningsCalendar(from, to) {
  return await api.earnings(from, to);
}

export async function getStockNews(symbol, limit = 20) {
  try {
    const data = await api.news(symbol);
    if (Array.isArray(data) && data.length > 0) return data;
  } catch {}
  try {
    const data = await api.generalNews();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function searchSymbol(query) {
  return await api.search(query);
}

export async function getQuotes(symbols) {
  const data = await api.quotes(symbols);
  return Array.isArray(data) ? data : [data];
}

export async function getSectorPerformance() {
  return await api.sectors();
}

export async function getEconomicCalendar(from, to) {
  return await api.economicCalendar(from, to);
}

export async function getGainers() {
  return await api.gainers();
}

export async function getLosers() {
  return await api.losers();
}

export async function getActives() {
  return await api.actives();
}

export async function getGeneralNews(limit = 20) {
  return await api.generalNews();
}

export async function getMacroData() {
  return await api.macro();
}

export async function getInsiderTrading(symbol) {
  return await api.insiderTrading(symbol);
}

export async function getAnalysis(symbol) {
  return await api.analysis(symbol);
}
