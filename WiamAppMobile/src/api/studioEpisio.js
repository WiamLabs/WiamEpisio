import apiClient from './client';

function fmt(error, fallback) {
  let msg = error.response?.data?.error || error.response?.data?.message || error.message || fallback;
  if (msg != null && typeof msg !== 'string') {
    try { msg = JSON.stringify(msg); } catch { msg = String(msg); }
  }
  const err = new Error(msg || fallback);
  err.data = error.response?.data;
  err.status = error.response?.status;
  throw err;
}

const studioEpisioApi = {
  mediaSpecs: async () => {
    try { return (await apiClient.get('/episio/media-specs')).data; }
    catch (e) { throw fmt(e, 'Failed to load media specs'); }
  },
  search: async (q) => {
    try { return (await apiClient.get('/watch/search', { params: { q } })).data; }
    catch (e) { throw fmt(e, 'Search failed'); }
  },
  remind: async (seriesId) => {
    try { return (await apiClient.post(`/series/${seriesId}/remind`)).data; }
    catch (e) { throw fmt(e, 'Could not set reminder'); }
  },
  unremind: async (seriesId) => {
    try { return (await apiClient.delete(`/series/${seriesId}/remind`)).data; }
    catch (e) { throw fmt(e, 'Could not remove reminder'); }
  },
  listReminders: async () => {
    try { return (await apiClient.get('/watch/reminders')).data; }
    catch (e) { throw fmt(e, 'Failed to load reminders'); }
  },
  getApply: async () => {
    try { return (await apiClient.get('/creator/episio/apply')).data; }
    catch (e) { throw fmt(e, 'Failed to load application'); }
  },
  submitApply: async (payload) => {
    try { return (await apiClient.post('/creator/episio/apply', payload)).data; }
    catch (e) { throw fmt(e, 'Application failed'); }
  },
  joinWaitlist: async (payload) => {
    try {
      return (await apiClient.post('/creator/episio/apply', { waitlist: true, ...payload })).data;
    } catch (e) { throw fmt(e, 'Waitlist failed'); }
  },
  redeemInvite: async (inviteCode, extra = {}) => {
    try {
      return (await apiClient.post('/creator/episio/redeem-invite', {
        invite_code: inviteCode,
        ...extra,
      })).data;
    } catch (e) { throw fmt(e, 'Invite redeem failed'); }
  },
  getStudioProfile: async () => {
    try { return (await apiClient.get('/creator/studio/profile')).data; }
    catch (e) { throw fmt(e, 'Failed to load studio profile'); }
  },
  patchStudioProfile: async (payload) => {
    try { return (await apiClient.patch('/creator/studio/profile', payload)).data; }
    catch (e) { throw fmt(e, 'Failed to save studio profile'); }
  },
  listSeries: async () => {
    try { return (await apiClient.get('/creator/studio/series')).data; }
    catch (e) { throw fmt(e, 'Failed to load Studio series'); }
  },
  createSeries: async (payload) => {
    try { return (await apiClient.post('/creator/studio/series', payload)).data; }
    catch (e) { throw fmt(e, 'Failed to create series'); }
  },
  createRevisionRequest: async (seriesId, payload) => {
    try {
      return (await apiClient.post(`/creator/studio/series/${seriesId}/revision-requests`, payload)).data;
    } catch (e) { throw fmt(e, 'Revision request failed'); }
  },
  listRevisionRequests: async (seriesId) => {
    try {
      return (await apiClient.get(`/creator/studio/series/${seriesId}/revision-requests`)).data;
    } catch (e) { throw fmt(e, 'Failed to load revision requests'); }
  },
  getSeries: async (id) => {
    try { return (await apiClient.get(`/creator/studio/series/${id}`)).data; }
    catch (e) { throw fmt(e, 'Failed to load series'); }
  },
  patchSeries: async (id, payload) => {
    try { return (await apiClient.patch(`/creator/studio/series/${id}`, payload)).data; }
    catch (e) { throw fmt(e, 'Failed to update series'); }
  },
  completeness: async (seriesId) => {
    try { return (await apiClient.get(`/creator/studio/series/${seriesId}/completeness`)).data; }
    catch (e) { throw fmt(e, 'Failed to load completeness'); }
  },
  lockSeason: async (seriesId, { confirm = true, rights_confirmed = true } = {}) => {
    try {
      return (await apiClient.post(`/creator/studio/series/${seriesId}/lock`, {
        confirm, rights_confirmed,
      })).data;
    } catch (e) { throw fmt(e, 'Could not lock season'); }
  },
  trustTier: async () => {
    try { return (await apiClient.get('/creator/studio/trust-tier')).data; }
    catch (e) { throw fmt(e, 'Failed to load trust tier'); }
  },
  uploadCover: async (seriesId, uri) => {
    try {
      const form = new FormData();
      const name = uri.split('/').pop() || 'cover.jpg';
      form.append('cover', { uri, name, type: 'image/jpeg' });
      return (await apiClient.post(`/creator/studio/series/${seriesId}/cover`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })).data;
    } catch (e) { throw fmt(e, 'Cover upload failed'); }
  },
  uploadBanner: async (seriesId, uri) => {
    try {
      const form = new FormData();
      const name = uri.split('/').pop() || 'banner.jpg';
      form.append('banner', { uri, name, type: 'image/jpeg' });
      return (await apiClient.post(`/creator/studio/series/${seriesId}/banner`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })).data;
    } catch (e) { throw fmt(e, 'Banner upload failed'); }
  },
  createEpisode: async (seriesId, payload = {}) => {
    try { return (await apiClient.post(`/creator/studio/series/${seriesId}/episodes`, payload)).data; }
    catch (e) { throw fmt(e, 'Failed to create episode'); }
  },
  completeUpload: async (episodeId, meta) => {
    try { return (await apiClient.post(`/creator/studio/episodes/${episodeId}/complete-upload`, meta)).data; }
    catch (e) { throw fmt(e, 'Upload validation failed'); }
  },
  markFinal: async (episodeId, isFinal = true) => {
    try {
      return (await apiClient.post(`/creator/studio/episodes/${episodeId}/mark-final`, {
        is_final: isFinal,
      })).data;
    } catch (e) { throw fmt(e, 'Could not mark episode final'); }
  },
  patchEpisode: async (episodeId, payload) => {
    try {
      return (await apiClient.patch(`/creator/studio/episodes/${episodeId}`, payload)).data;
    } catch (e) { throw fmt(e, 'Could not update episode'); }
  },
  reviewStatus: async (seriesId) => {
    try { return (await apiClient.get(`/creator/studio/series/${seriesId}/review-status`)).data; }
    catch (e) { throw fmt(e, 'Failed to load review status'); }
  },
  submitReview: async (seriesId) => {
    try { return (await apiClient.post(`/creator/studio/series/${seriesId}/submit-review`)).data; }
    catch (e) { throw fmt(e, 'Submit failed'); }
  },
  uploadTrailer: async (seriesId, meta = {}) => {
    try {
      return (await apiClient.post(`/creator/series/${seriesId}/trailer/upload`, {
        meta: {
          duration_seconds: meta.duration_seconds || 45,
          width: meta.width || 1080,
          height: meta.height || 1920,
          bitrate_kbps: meta.bitrate_kbps || 2500,
          mood_label: 'serious',
          black_frame_ratio: 0.02,
          ...meta,
        },
        duration_seconds: meta.duration_seconds || 45,
        width: meta.width || 1080,
        height: meta.height || 1920,
      })).data;
    } catch (e) { throw fmt(e, 'Trailer upload failed'); }
  },
};

export default studioEpisioApi;
