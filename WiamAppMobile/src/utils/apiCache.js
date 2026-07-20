import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@api_cache:';
const DEFAULT_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Get cached API response.
 * Returns { data, expired } or null if no cache.
 */
export async function getCache(key) {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { data, ts, ttl } = JSON.parse(raw);
    const expired = Date.now() - ts > (ttl || DEFAULT_TTL);
    return { data, expired };
  } catch {
    return null;
  }
}

/**
 * Store API response in cache.
 */
export async function setCache(key, data, ttl = DEFAULT_TTL) {
  try {
    await AsyncStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ data, ts: Date.now(), ttl })
    );
  } catch {}
}

/**
 * Fetch with cache-first strategy:
 * 1. If cache exists and not expired → return cached data, no fetch
 * 2. If cache exists but expired → return cached data immediately, fetch in background
 * 3. If no cache → fetch and wait
 *
 * @param {string} cacheKey - unique key for this request
 * @param {Function} fetcher - async function that returns data
 * @param {Function} onUpdate - called when background refresh completes with fresh data
 * @param {number} ttl - cache TTL in ms (default 10 min)
 */
export async function cachedFetch(cacheKey, fetcher, onUpdate, ttl = DEFAULT_TTL) {
  const cached = await getCache(cacheKey);

  if (cached && !cached.expired) {
    // Fresh cache — use it, no network call
    return cached.data;
  }

  if (cached && cached.expired) {
    // Stale cache — return it now, refresh in background
    fetcher()
      .then((freshData) => {
        setCache(cacheKey, freshData, ttl);
        if (onUpdate) onUpdate(freshData);
      })
      .catch(() => {});
    return cached.data;
  }

  // No cache — must wait for network
  const data = await fetcher();
  setCache(cacheKey, data, ttl);
  return data;
}

/**
 * Clear all API caches (e.g. on logout).
 */
export async function clearAllCache() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
    if (cacheKeys.length) await AsyncStorage.multiRemove(cacheKeys);
  } catch {}
}
