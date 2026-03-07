import useSWR from 'swr';
import { getEarningsCalendar } from '../services/fmp';

async function fetchEarnings([, from, to]) {
  const result = await getEarningsCalendar(from, to);
  return Array.isArray(result) ? result : [];
}

export function useEarnings(from, to) {
  const { data, error, isLoading, mutate } = useSWR(
    from && to ? ['earnings', from, to] : null,
    fetchEarnings,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  return {
    data: data || [],
    loading: isLoading,
    error: error ? 'Failed to load earnings calendar.' : null,
    refetch: mutate,
  };
}
