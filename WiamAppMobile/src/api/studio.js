import apiClient from './client';

function fmt(error, fallback) {
  let msg = error.response?.data?.error || error.message || fallback;
  if (msg != null && typeof msg !== 'string') {
    try { msg = JSON.stringify(msg); } catch { msg = String(msg); }
  }
  const hint = error.networkHint ? `\n\n${error.networkHint}` : '';
  return `${msg || fallback}${hint}`;
}

const studioApi = {
  getGenres: async () => {
    try { return (await apiClient.get('/genres')).data; }
    catch (e) { throw fmt(e, 'Failed to fetch genres'); }
  },
  createStory: async ({ title, description, genre, author }) => {
    try { return (await apiClient.post('/studio/stories', { title, description, genre, author })).data; }
    catch (e) { throw fmt(e, 'Failed to create story'); }
  },
  getStory: async (bookId) => {
    try { return (await apiClient.get(`/studio/stories/${bookId}`)).data; }
    catch (e) { throw fmt(e, 'Failed to fetch story'); }
  },
  getChapter: async (bookId, chNum) => {
    try { return (await apiClient.get(`/studio/stories/${bookId}/chapter/${chNum}`)).data; }
    catch (e) { throw fmt(e, 'Failed to fetch chapter'); }
  },
  saveChapter: async (bookId, { chapter_number, chapter_title, body, word_count }) => {
    try { return (await apiClient.post(`/studio/stories/${bookId}/save`, { chapter_number, chapter_title, body, word_count })).data; }
    catch (e) { throw fmt(e, 'Failed to save chapter'); }
  },
  addChapter: async (bookId) => {
    try { return (await apiClient.post(`/studio/stories/${bookId}/chapter/add`)).data; }
    catch (e) { throw fmt(e, 'Failed to add chapter'); }
  },
  deleteChapter: async (bookId, chNum) => {
    try { return (await apiClient.post(`/studio/stories/${bookId}/chapter/${chNum}/delete`)).data; }
    catch (e) { throw fmt(e, 'Failed to delete chapter'); }
  },
  updateSettings: async (bookId, settings) => {
    try { return (await apiClient.post(`/studio/stories/${bookId}/settings`, settings)).data; }
    catch (e) { throw fmt(e, 'Failed to update settings'); }
  },
  uploadCover: async (bookId, imageUri) => {
    try {
      const form = new FormData();
      const ext = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
      form.append('cover', { uri: imageUri, name: `cover.${ext}`, type: `image/${ext === 'jpg' ? 'jpeg' : ext}` });
      return (await apiClient.post(`/studio/stories/${bookId}/cover`, form, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
    } catch (e) { throw fmt(e, 'Failed to upload cover'); }
  },
  publishStory: async (bookId, action = 'ongoing') => {
    try { return (await apiClient.post(`/studio/stories/${bookId}/publish`, { action })).data; }
    catch (e) { throw fmt(e, 'Failed to publish story'); }
  },
  publishChapter: async (bookId, chNum, publish = true) => {
    try { return (await apiClient.post(`/studio/stories/${bookId}/chapter/${chNum}/publish`, { publish })).data; }
    catch (e) { throw fmt(e, 'Failed to update chapter status'); }
  },
  deleteStory: async (bookId) => {
    try { return (await apiClient.post(`/studio/stories/${bookId}/delete`)).data; }
    catch (e) { throw fmt(e, 'Failed to delete story'); }
  },
  publishAllDrafts: async (bookId) => {
    try { return (await apiClient.post(`/studio/stories/${bookId}/publish-all-chapters`)).data; }
    catch (e) { throw fmt(e, 'Failed to publish all drafts'); }
  },
  getStoryAnalytics: async (bookId) => {
    try { return (await apiClient.get(`/creator/stories/${bookId}/analytics`)).data; }
    catch (e) { throw fmt(e, 'Failed to load analytics'); }
  },
  listMyStories: async () => {
    try { return (await apiClient.get(`/creator/stories`)).data; }
    catch (e) { throw fmt(e, 'Failed to load stories'); }
  },
};

export default studioApi;
