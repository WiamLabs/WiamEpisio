import apiClient from './client';

const BASE = '/reader';

const readerApi = {
  getReactions: async (contentId, chapterNumber) => {
    const res = await apiClient.get(`${BASE}/reactions`, {
      params: { content_id: contentId, chapter_number: chapterNumber },
    });
    return res.data;
  },

  react: async (contentId, chapterNumber, paragraphIndex, emoji) => {
    const res = await apiClient.post(`${BASE}/react`, {
      content_id: contentId,
      chapter_number: chapterNumber,
      paragraph_index: paragraphIndex,
      emoji,
    });
    return res.data;
  },

  getComments: async (contentId, chapterNumber, paragraphIndex, sort = 'newest') => {
    const res = await apiClient.get(`${BASE}/comments`, {
      params: {
        content_id: contentId,
        chapter_number: chapterNumber,
        paragraph_index: paragraphIndex,
        sort,
      },
    });
    return res.data;
  },

  getCommentCounts: async (contentId, chapterNumber) => {
    const res = await apiClient.get(`${BASE}/comment-counts`, {
      params: { content_id: contentId, chapter_number: chapterNumber },
    });
    return res.data;
  },

  addComment: async (contentId, chapterNumber, paragraphIndex, text, parentId = null) => {
    const res = await apiClient.post(`${BASE}/comment`, {
      content_id: contentId,
      chapter_number: chapterNumber,
      paragraph_index: paragraphIndex,
      text,
      parent_id: parentId,
    });
    return res.data;
  },

  likeComment: async (commentId) => {
    const res = await apiClient.post(`${BASE}/comment/${commentId}/like`);
    return res.data;
  },

  deleteComment: async (commentId) => {
    const res = await apiClient.post(`${BASE}/comment/${commentId}/delete`);
    return res.data;
  },

  reportComment: async (commentId, category = 'other', description = '') => {
    const res = await apiClient.post(`${BASE}/comment/${commentId}/report`, {
      category,
      description,
    });
    return res.data;
  },

  savePosition: async (contentId, chapterNumber, position, paragraphIndex = 0) => {
    const res = await apiClient.post(`${BASE}/save-position`, {
      content_id: contentId,
      chapter_number: chapterNumber,
      position,
      paragraph_index: paragraphIndex,
    });
    return res.data;
  },
};

export default readerApi;
