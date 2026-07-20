/**
 * WiamStudio V2 client — Push 9.
 *
 * Wraps every endpoint that landed in Push 8: universe / series / arc
 * CRUD, creator settings, Studio Pro status + IAP, scheduled publish.
 *
 * Conventions:
 *   - Every helper returns the parsed JSON body (or throws a string error
 *     extracted from the API).
 *   - 402 (Pro required) is surfaced as a custom error object so the
 *     calling screen can route to the paywall: `throw { proRequired: true }`.
 */
import apiClient from './client';

function fmt(error, fallback) {
  if (error?.response?.status === 402) {
    const data = error?.response?.data || {};
    const e = new Error(data.message || 'Studio Pro required');
    e.proRequired = true;
    e.upgradeUrl = data.upgrade_url || null;
    return e;
  }
  let msg = error.response?.data?.error || error.message || fallback;
  if (msg != null && typeof msg !== 'string') {
    try { msg = JSON.stringify(msg); } catch { msg = String(msg); }
  }
  const hint = error.networkHint ? `\n\n${error.networkHint}` : '';
  return `${msg || fallback}${hint}`;
}

const studioV2Api = {
  // ── Universes ──────────────────────────────────────────────────────────
  listUniverses: async () => {
    try { return (await apiClient.get('/universes')).data; }
    catch (e) { throw fmt(e, 'Failed to load universes'); }
  },
  getUniverse: async (id) => {
    try { return (await apiClient.get(`/universes/${id}`)).data; }
    catch (e) { throw fmt(e, 'Failed to load universe'); }
  },
  createUniverse: async (payload) => {
    try { return (await apiClient.post('/universes', payload)).data; }
    catch (e) { throw fmt(e, 'Failed to create universe'); }
  },
  updateUniverse: async (id, payload) => {
    try { return (await apiClient.patch(`/universes/${id}`, payload)).data; }
    catch (e) { throw fmt(e, 'Failed to update universe'); }
  },
  deleteUniverse: async (id) => {
    try { return (await apiClient.delete(`/universes/${id}`)).data; }
    catch (e) { throw fmt(e, 'Failed to delete universe'); }
  },

  // ── Series ─────────────────────────────────────────────────────────────
  listSeries: async (universeId) => {
    const path = universeId ? `/series?universe_id=${universeId}` : '/series';
    try { return (await apiClient.get(path)).data; }
    catch (e) { throw fmt(e, 'Failed to load series'); }
  },
  getSeries: async (id) => {
    try { return (await apiClient.get(`/series/${id}`)).data; }
    catch (e) { throw fmt(e, 'Failed to load series'); }
  },
  createSeries: async (payload) => {
    try { return (await apiClient.post('/series', payload)).data; }
    catch (e) { throw fmt(e, 'Failed to create series'); }
  },
  updateSeries: async (id, payload) => {
    try { return (await apiClient.patch(`/series/${id}`, payload)).data; }
    catch (e) { throw fmt(e, 'Failed to update series'); }
  },
  deleteSeries: async (id) => {
    try { return (await apiClient.delete(`/series/${id}`)).data; }
    catch (e) { throw fmt(e, 'Failed to delete series'); }
  },
  addBookToSeries: async (seriesId, contentId, sortOrder) => {
    try {
      return (
        await apiClient.post(`/series/${seriesId}/books`, {
          content_id: contentId,
          sort_order: sortOrder,
        })
      ).data;
    } catch (e) { throw fmt(e, 'Failed to add book to series'); }
  },
  removeBookFromSeries: async (seriesId, contentId) => {
    try { return (await apiClient.delete(`/series/${seriesId}/books/${contentId}`)).data; }
    catch (e) { throw fmt(e, 'Failed to remove book from series'); }
  },
  reorderSeriesBooks: async (seriesId, order) => {
    try { return (await apiClient.post(`/series/${seriesId}/books/reorder`, { order })).data; }
    catch (e) { throw fmt(e, 'Failed to reorder books'); }
  },

  // ── Arcs ───────────────────────────────────────────────────────────────
  listArcs: async (bookId) => {
    try { return (await apiClient.get(`/stories/${bookId}/arcs`)).data; }
    catch (e) { throw fmt(e, 'Failed to load arcs'); }
  },
  createArc: async (bookId, payload) => {
    try { return (await apiClient.post(`/stories/${bookId}/arcs`, payload)).data; }
    catch (e) { throw fmt(e, 'Failed to create arc'); }
  },
  updateArc: async (arcId, payload) => {
    try { return (await apiClient.patch(`/arcs/${arcId}`, payload)).data; }
    catch (e) { throw fmt(e, 'Failed to update arc'); }
  },
  deleteArc: async (arcId) => {
    try { return (await apiClient.delete(`/arcs/${arcId}`)).data; }
    catch (e) { throw fmt(e, 'Failed to delete arc'); }
  },

  // ── Schedule ───────────────────────────────────────────────────────────
  scheduleChapter: async (bookId, chNum, isoTimestamp) => {
    try {
      return (
        await apiClient.post(`/studio/stories/${bookId}/chapter/${chNum}/schedule`, {
          publish_at: isoTimestamp,
        })
      ).data;
    } catch (e) { throw fmt(e, 'Failed to schedule chapter'); }
  },
  unscheduleChapter: async (bookId, chNum) => {
    try {
      return (
        await apiClient.post(`/studio/stories/${bookId}/chapter/${chNum}/schedule`, {
          publish_at: null,
        })
      ).data;
    } catch (e) { throw fmt(e, 'Failed to unschedule chapter'); }
  },

  // ── Settings ───────────────────────────────────────────────────────────
  getSettings: async () => {
    try { return (await apiClient.get('/studio/settings')).data; }
    catch (e) { throw fmt(e, 'Failed to load settings'); }
  },
  updateSettings: async (payload) => {
    try { return (await apiClient.patch('/studio/settings', payload)).data; }
    catch (e) { throw fmt(e, 'Failed to update settings'); }
  },

  // ── Pro ────────────────────────────────────────────────────────────────
  getProStatus: async () => {
    try { return (await apiClient.get('/studio/pro/status')).data; }
    catch (e) { throw fmt(e, 'Failed to load Pro status'); }
  },
  getProProducts: async () => {
    try { return (await apiClient.get('/studio/pro/products')).data; }
    catch (e) { throw fmt(e, 'Failed to load products'); }
  },
  postIapReceipt: async (payload) => {
    try { return (await apiClient.post('/studio/pro/iap-receipt', payload)).data; }
    catch (e) { throw fmt(e, 'Failed to validate receipt'); }
  },

  // ── Reader V2 ──────────────────────────────────────────────────────────
  /** Public universe page (any reader, no JWT needed). */
  getUniversePublic: async (id) => {
    try { return (await apiClient.get(`/universes/${id}/public`)).data; }
    catch (e) { throw fmt(e, 'Failed to load universe'); }
  },
  /** Public series page (any reader, no JWT needed). */
  getSeriesPublic: async (id) => {
    try { return (await apiClient.get(`/series/${id}/public`)).data; }
    catch (e) { throw fmt(e, 'Failed to load series'); }
  },
  /** Series this book belongs to + ordered list of siblings. */
  getBookSeriesContext: async (bookId) => {
    try { return (await apiClient.get(`/books/${bookId}/series-context`)).data; }
    catch (e) { throw fmt(e, 'Failed to load series context'); }
  },
  /** Next book in any public series this book belongs to. */
  getNextInSeries: async (bookId) => {
    try { return (await apiClient.get(`/books/${bookId}/next-in-series`)).data; }
    catch (e) { throw fmt(e, 'Failed to load next book'); }
  },
  /** Per-user lock state for a chapter (free/coin/premium/Pro). */
  getChapterAccess: async (bookId, chapterNumber) => {
    try {
      return (
        await apiClient.get(`/books/${bookId}/chapter/${chapterNumber}/access`)
      ).data;
    } catch (e) { throw fmt(e, 'Failed to check chapter access'); }
  },
};

export default studioV2Api;
