import apiClient from './client';

function formatAxiosError(error, fallback) {
  let msg =
    error.response?.data?.error ||
    error.message ||
    (error.code === 'ECONNABORTED' ? 'Request timed out' : null) ||
    fallback;
  if (msg != null && typeof msg !== 'string') {
    try {
      msg = JSON.stringify(msg);
    } catch {
      msg = String(msg);
    }
  }
  const hint = error.networkHint ? `\n\n${error.networkHint}` : '';
  return `${msg || fallback}${hint}`;
}

const booksApi = {
  getHomeFeed: async () => {
    try {
      const response = await apiClient.get('/home');
      return response.data;
    } catch (error) {
      throw formatAxiosError(error, 'Failed to fetch home feed');
    }
  },

  getBooks: async (params = {}) => {
    try {
      const response = await apiClient.get('/books', { params });
      return response.data;
    } catch (error) {
      throw formatAxiosError(error, 'Failed to fetch books');
    }
  },

  getBookDetail: async (bookId) => {
    try {
      const response = await apiClient.get(`/books/${bookId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch book details';
    }
  },

  toggleLibrary: async (bookId) => {
    try {
      const response = await apiClient.post(`/books/${bookId}/library/toggle`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to update library';
    }
  },

  getMyLibrary: async () => {
    try {
      const response = await apiClient.get('/library');
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch library';
    }
  },

  readChapter: async (bookId, chNum) => {
    try {
      const response = await apiClient.get(`/books/${bookId}/chapters/${chNum}`);
      return {
        ...response.data,
        title: response.data.chapter_title || response.data.title,
        content: response.data.body || response.data.content,
      };
    } catch (error) {
      const data = error.response?.data || {};
      if (data.locked) {
        const e = new Error(data.error || 'Chapter is locked');
        e.locked = true;
        e.price = data.price || 0;
        e.premiumLocked = data.premium_locked || false;
        e.status = error.response?.status;
        throw e;
      }
      throw error.response?.data?.error || 'Failed to fetch chapter content';
    }
  },

  getGenres: async () => {
    try {
      const response = await apiClient.get('/genres');
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch genres';
    }
  },

  searchBooks: async (query) => {
    try {
      const response = await apiClient.get('/search', { params: { q: query } });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Search failed';
    }
  },

  /** Matches web home “Trending Now” data source (api_v1 /trending). */
  getTrending: async () => {
    try {
      const response = await apiClient.get('/trending');
      return response.data;
    } catch (error) {
      throw formatAxiosError(error, 'Failed to fetch trending');
    }
  },

  tipCreator: async (bookId, amount) => {
    try {
      const response = await apiClient.post(`/books/${bookId}/tip`, { amount });
      return response.data;
    } catch (error) {
      const data = error.response?.data || {};
      if (data.need_coins) {
        const err = new Error(data.error || 'Not enough coins');
        err.needCoins = true;
        throw err;
      }
      throw formatAxiosError(error, 'Failed to send tip');
    }
  },

  /** Matches web home “Editor's Choice” featured row (api_v1 /featured). */
  getFeatured: async () => {
    try {
      const response = await apiClient.get('/featured');
      return response.data;
    } catch (error) {
      throw formatAxiosError(error, 'Failed to fetch featured');
    }
  },

  // ── Reviews ────────────────────────────────────────────────────────
  getReviews: async (bookId, page = 1) => {
    const response = await apiClient.get(`/books/${bookId}/reviews`, { params: { page } });
    return response.data;
  },
  createReview: async (bookId, text) => {
    const response = await apiClient.post(`/books/${bookId}/reviews`, { text });
    return response.data;
  },
  deleteReview: async (bookId, reviewId) => {
    const response = await apiClient.delete(`/books/${bookId}/reviews/${reviewId}`);
    return response.data;
  },
  toggleReviewLike: async (reviewId) => {
    const response = await apiClient.post(`/reviews/${reviewId}/like`);
    return response.data;
  },

  // ── Reading Lists ──────────────────────────────────────────────────
  getReadingLists: async () => {
    const response = await apiClient.get('/reading-lists');
    return response.data;
  },
  createReadingList: async (name, description = '', isPublic = true) => {
    const response = await apiClient.post('/reading-lists', { name, description, is_public: isPublic });
    return response.data;
  },
  getReadingList: async (listId) => {
    const response = await apiClient.get(`/reading-lists/${listId}`);
    return response.data;
  },
  updateReadingList: async (listId, data) => {
    const response = await apiClient.patch(`/reading-lists/${listId}`, data);
    return response.data;
  },
  deleteReadingList: async (listId) => {
    const response = await apiClient.delete(`/reading-lists/${listId}`);
    return response.data;
  },
  addToReadingList: async (listId, contentId, note = '') => {
    const response = await apiClient.post(`/reading-lists/${listId}/items`, { content_id: contentId, note });
    return response.data;
  },
  removeFromReadingList: async (listId, contentId) => {
    const response = await apiClient.delete(`/reading-lists/${listId}/items/${contentId}`);
    return response.data;
  },

  // ── Reader Stats & Badges ─────────────────────────────────────────
  getReaderStats: async () => {
    const response = await apiClient.get('/reader/stats');
    return response.data;
  },
  getReaderBadges: async () => {
    const response = await apiClient.get('/reader/badges');
    return response.data;
  },

  // ── Push 3 — engagement instrumentation ───────────────────────────
  /** Time-based view counter — fires after the reader has spent ~30s
   * on a chapter. Server dedupes per (user, book, day) so calling more
   * than once on the same day is harmless. Returns { counted, views }. */
  recordView: async (bookId) => {
    try {
      const response = await apiClient.post(`/books/${bookId}/record-view`);
      return response.data;
    } catch {
      return { counted: false };
    }
  },
};

export default booksApi;
