/**
 * WiamEpisio watch catalog client — matches /api/v1/watch/* + trailer APIs.
 */
import apiClient from './client';

function fmt(error, fallback) {
  let msg = error.response?.data?.error || error.message || fallback;
  if (msg != null && typeof msg !== 'string') {
    try { msg = JSON.stringify(msg); } catch { msg = String(msg); }
  }
  return msg || fallback;
}

const watchApi = {
  home: async () => {
    try { return (await apiClient.get('/watch/home')).data; }
    catch (e) { throw fmt(e, 'Failed to load Watch home'); }
  },
  rankings: async (period = 'weekly') => {
    try { return (await apiClient.get('/watch/rankings', { params: { period } })).data; }
    catch (e) { throw fmt(e, 'Failed to load rankings'); }
  },
  shelf: async (shelf) => {
    try { return (await apiClient.get(`/watch/shelf/${shelf}`)).data; }
    catch (e) { throw fmt(e, 'Failed to load shelf'); }
  },
  trailerStream: async (seriesId) => {
    try { return (await apiClient.get(`/series/${seriesId}/trailer/stream`)).data; }
    catch (e) { throw fmt(e, 'Failed to load trailer'); }
  },
  search: async (q) => {
    try { return (await apiClient.get('/watch/search', { params: { q } })).data; }
    catch (e) { throw fmt(e, 'Search failed'); }
  },
};

export default watchApi;
