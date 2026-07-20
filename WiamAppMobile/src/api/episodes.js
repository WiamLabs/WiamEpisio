/**
 * WiamEpisio drama Series / Episode / Watch API client.
 * Used by DramaSeriesScreen + PlayerScreen.
 */
import apiClient from './client';

function fmt(error, fallback) {
  let msg = error.response?.data?.error || error.message || fallback;
  if (msg != null && typeof msg !== 'string') {
    try { msg = JSON.stringify(msg); } catch { msg = String(msg); }
  }
  return msg || fallback;
}

const episodesApi = {
  listSeries: async (params = {}) => {
    try {
      return (await apiClient.get('/series', { params })).data;
    } catch (e) { throw fmt(e, 'Failed to load series'); }
  },
  getSeries: async (id) => {
    try { return (await apiClient.get(`/series/${id}`)).data; }
    catch (e) { throw fmt(e, 'Failed to load series'); }
  },
  listEpisodes: async (seriesId) => {
    try { return (await apiClient.get(`/series/${seriesId}/episodes`)).data; }
    catch (e) { throw fmt(e, 'Failed to load episodes'); }
  },
  getStream: async (episodeId) => {
    try { return (await apiClient.get(`/episodes/${episodeId}/stream`)).data; }
    catch (e) {
      const status = e?.response?.status;
      const data = e?.response?.data || {};
      if (status === 402 || data.error === 'locked') {
        const err = new Error(data.error || 'locked');
        err.locked = true;
        err.reason = data.reason;
        err.unlock_price_coins = data.unlock_price_coins;
        throw err;
      }
      if (status === 401 || data.error === 'login_required') {
        const err = new Error(data.error || 'login_required');
        err.loginRequired = true;
        err.reason = data.reason;
        throw err;
      }
      throw fmt(e, 'Failed to get stream');
    }
  },
  unlockEpisode: async (episodeId) => {
    try { return (await apiClient.post(`/episodes/${episodeId}/unlock`)).data; }
    catch (e) {
      const data = e?.response?.data || {};
      if (e?.response?.status === 402) {
        const err = new Error(data.error || 'Need more coins');
        err.needCoins = true;
        err.balance = data.balance;
        throw err;
      }
      throw fmt(e, 'Failed to unlock episode');
    }
  },
  saveProgress: async (payload) => {
    try { return (await apiClient.post('/watch/save-progress', payload)).data; }
    catch (e) { throw fmt(e, 'Failed to save watch progress'); }
  },
  continueWatching: async () => {
    try { return (await apiClient.get('/watch/continue-watching')).data; }
    catch (e) { throw fmt(e, 'Failed to load continue watching'); }
  },
};

export default episodesApi;
