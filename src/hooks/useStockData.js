import { useEffect } from 'react';
import useSWR from 'swr';
import { getQuote, getProfile } from '../services/fmp';
import { useApp } from '../context/AppContext';

async function fetchStockData(symbol) {
  const [quote, profile] = await Promise.all([getQuote(symbol), getProfile(symbol)]);
  return { quote, profile };
}

export function useStockData(symbol) {
  const { setQuote, setProfile } = useApp();

  const { data, error, isLoading, mutate } = useSWR(
    symbol ? `stock-${symbol}` : null,
    () => fetchStockData(symbol),
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  useEffect(() => {
    if (data?.quote) setQuote(data.quote);
    if (data?.profile) setProfile(data.profile);
  }, [data, setQuote, setProfile]);

  return {
    quote: data?.quote || null,
    profile: data?.profile || null,
    loading: isLoading,
    error: error ? 'Failed to load stock data.' : null,
    refetch: mutate,
  };
}
