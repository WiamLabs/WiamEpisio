/**
 * Guest one-series law: guests may finish one series; a different series → register.
 * Logged-in users are always allowed.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@episio_guest_series_id';

export async function getGuestSeriesId() {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v ? String(v) : null;
  } catch {
    return null;
  }
}

export async function claimGuestSeries(seriesId) {
  if (seriesId == null) return { ok: true };
  const id = String(seriesId);
  const existing = await getGuestSeriesId();
  if (!existing) {
    await AsyncStorage.setItem(KEY, id);
    return { ok: true, claimed: true };
  }
  if (existing === id) return { ok: true };
  return { ok: false, lockedSeriesId: existing };
}

export async function clearGuestSeries() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch { /* ignore */ }
}

/**
 * @returns {{ allowed: boolean, reason?: string }}
 */
export async function assertGuestCanWatchSeries(seriesId, isAuthenticated) {
  if (isAuthenticated) return { allowed: true };
  const result = await claimGuestSeries(seriesId);
  if (result.ok) return { allowed: true };
  return {
    allowed: false,
    reason: 'register_for_another_series',
    lockedSeriesId: result.lockedSeriesId,
  };
}
