/**
 * Episio genres from founder DB — never hardcode drama taxonomy in screens.
 */
import { useCallback, useEffect, useState } from 'react';
import apiClient from '../api/client';

const FALLBACK = [
  'Drama', 'Romance', 'Revenge', 'Hidden Identity', 'Royal & Palace',
  'Family Feud', 'Comedy', 'Thriller', 'Action', 'Fantasy', 'Anime',
];

export async function fetchEpisioGenres() {
  try {
    const { data } = await apiClient.get('/episio/genres');
    const list = data?.genres || [];
    const names = list.map((g) => g.name || g).filter(Boolean);
    return names.length ? names : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

export function useEpisioGenres({ includeAll = false } = {}) {
  const [genres, setGenres] = useState(includeAll ? ['All', ...FALLBACK] : FALLBACK);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const names = await fetchEpisioGenres();
    setGenres(includeAll ? ['All', ...names] : names);
    setLoading(false);
  }, [includeAll]);

  useEffect(() => { reload(); }, [reload]);

  return { genres, loading, reload };
}

export default useEpisioGenres;
