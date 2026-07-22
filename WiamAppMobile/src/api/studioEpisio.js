import apiClient from './client';

function fmt(error, fallback) {
  const raw = error?.message || '';
  const code = error?.code || error?.response?.status;
  const isTimeout = code === 'ECONNABORTED'
    || /timeout/i.test(raw)
    || /exceeded/i.test(raw);
  let msg = error.response?.data?.error || error.response?.data?.message || error.message || fallback;
  if (isTimeout) {
    msg = 'Studio is taking a moment to wake up. Pull to refresh — your work is safe.';
  } else if (msg != null && typeof msg !== 'string') {
    try { msg = JSON.stringify(msg); } catch { msg = String(msg); }
  }
  if (typeof msg === 'string' && /timeout of \d+ms exceeded/i.test(msg)) {
    msg = 'Studio is taking a moment to wake up. Pull to refresh — your work is safe.';
  }
  const err = new Error(msg || fallback);
  err.data = error.response?.data;
  err.status = error.response?.status;
  throw err;
}

const studioEpisioApi = {
  requestGenre: async (name, note = '') => {
    try {
      return (await apiClient.post('/creator/studio/genre-requests', { name, note })).data;
    } catch (e) { throw fmt(e, 'Could not request genre'); }
  },
  listGenreRequests: async () => {
    try { return (await apiClient.get('/creator/studio/genre-requests')).data; }
    catch (e) { throw fmt(e, 'Failed to load genre requests'); }
  },
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
  uploadChannelAvatar: async (uri) => {
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'avatar.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';
      formData.append('avatar', { uri, name: filename, type });
      return (await apiClient.post('/creator/studio/profile/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })).data;
    } catch (e) { throw fmt(e, 'Avatar upload failed'); }
  },
  deleteChannelAvatar: async () => {
    try { return (await apiClient.delete('/creator/studio/profile/avatar')).data; }
    catch (e) { throw fmt(e, 'Could not delete avatar'); }
  },
  uploadChannelBanner: async (uri) => {
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'banner.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';
      formData.append('banner', { uri, name: filename, type });
      return (await apiClient.post('/creator/studio/profile/banner', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })).data;
    } catch (e) { throw fmt(e, 'Banner upload failed'); }
  },
  deleteChannelBanner: async () => {
    try { return (await apiClient.delete('/creator/studio/profile/banner')).data; }
    catch (e) { throw fmt(e, 'Could not delete banner'); }
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
  deleteSeries: async (id) => {
    try { return (await apiClient.delete(`/creator/studio/series/${id}`)).data; }
    catch (e) { throw fmt(e, 'Could not delete series'); }
  },
  requestSeriesRemoval: async (id, message) => {
    try {
      return (await apiClient.post(`/creator/studio/series/${id}/removal-request`, { message })).data;
    } catch (e) { throw fmt(e, 'Could not send removal request'); }
  },
  completeness: async (seriesId) => {
    try { return (await apiClient.get(`/creator/studio/series/${seriesId}/completeness`)).data; }
    catch (e) { throw fmt(e, 'Failed to load completeness'); }
  },
  lockSeason: async (seriesId, { confirm = true, rights_confirmed } = {}) => {
    try {
      const body = { confirm };
      if (rights_confirmed != null) body.rights_confirmed = rights_confirmed;
      return (await apiClient.post(`/creator/studio/series/${seriesId}/lock`, body)).data;
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
  uploadEpisodeCover: async (episodeId, uri) => {
    try {
      const form = new FormData();
      const name = uri.split('/').pop() || 'ep_cover.jpg';
      form.append('cover', { uri, name, type: 'image/jpeg' });
      return (await apiClient.post(`/creator/studio/episodes/${episodeId}/cover`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })).data;
    } catch (e) { throw fmt(e, 'Episode cover upload failed'); }
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
  episodeUploadTicket: async (episodeId) => {
    try {
      return (await apiClient.post(`/creator/studio/episodes/${episodeId}/upload-ticket`)).data;
    } catch (e) { throw fmt(e, 'Could not start video upload'); }
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
  deleteEpisode: async (episodeId) => {
    try {
      return (await apiClient.delete(`/creator/studio/episodes/${episodeId}`)).data;
    } catch (e) { throw fmt(e, 'Could not delete episode'); }
  },
  reorderEpisodes: async (seriesId, episodeIds) => {
    try {
      return (await apiClient.post(`/creator/studio/series/${seriesId}/episodes/reorder`, {
        episode_ids: episodeIds,
      })).data;
    } catch (e) { throw fmt(e, 'Could not rearrange episodes'); }
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
      const body = {
        meta: {
          duration_seconds: meta.duration_seconds || 0,
          width: meta.width || 0,
          height: meta.height || 0,
          bitrate_kbps: meta.bitrate_kbps || 2500,
          mood_label: 'serious',
          black_frame_ratio: 0.02,
          ...meta,
        },
        duration_seconds: meta.duration_seconds || 0,
        width: meta.width || 0,
        height: meta.height || 0,
      };
      const data = (await apiClient.post(`/creator/series/${seriesId}/trailer/upload`, body)).data;
      const uploadUrl = data?.upload?.upload_url;
      const method = (data?.upload?.upload_method || 'PUT').toUpperCase();
      if (uploadUrl && meta.local_uri && !String(uploadUrl).includes('stub.local')) {
        const blob = await (await fetch(meta.local_uri)).blob();
        const putRes = await fetch(uploadUrl, {
          method,
          headers: { 'Content-Type': 'video/mp4' },
          body: blob,
        });
        if (!putRes.ok) {
          const err = new Error(`Could not upload trailer bytes (${putRes.status})`);
          err.data = { error: 'upload_put_failed' };
          throw err;
        }
      }
      return data;
    } catch (e) {
      if (e?.data?.error) throw e;
      throw fmt(e, 'Trailer upload failed');
    }
  },
};

export default studioEpisioApi;
