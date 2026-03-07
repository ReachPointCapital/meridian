import useSWR from 'swr';
import { getMacroData } from '../services/fmp';

const MACRO_LABELS = {
  'SPY': 'S&P 500',
  'QQQ': 'NASDAQ',
  'DIA': 'Dow Jones',
  'IWM': 'Russell 2000',
  'VXX': 'VIX',
  'GLD': 'Gold',
  'USO': 'Crude Oil',
};

async function fetchMacro() {
  const result = await getMacroData();
  const { quotes, btc, treasury } = result;

  const mapped = (quotes || []).map(q => ({
    symbol: q.symbol,
    label: MACRO_LABELS[q.symbol] || q.symbol,
    price: q.price,
    change: q.change,
    changesPercentage: q.changesPercentage,
  }));

  if (btc) {
    mapped.push({
      symbol: btc.symbol || 'BTC-USD',
      label: 'Bitcoin',
      price: btc.price,
      change: btc.change,
      changesPercentage: btc.changesPercentage,
    });
  }

  if (treasury && treasury.value != null) {
    mapped.push({
      symbol: 'TNX',
      label: '10Y Treasury',
      price: Number(treasury.value),
      change: null,
      changesPercentage: null,
      isTreasury: true,
    });
  }

  return mapped;
}

export function useMacroData() {
  const { data, error, isLoading, mutate } = useSWR('macro-data', fetchMacro, {
    refreshInterval: 60000,
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  });

  return {
    data: data || [],
    loading: isLoading,
    error: error ? 'Failed to load macro data.' : null,
    refetch: mutate,
  };
}
