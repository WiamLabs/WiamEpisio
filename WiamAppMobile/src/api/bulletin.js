import apiClient from './client';

const bulletinApi = {
  getFeed: async (page = 1) => {
    try {
      const response = await apiClient.get('/bulletin/feed', { params: { page } });
      return response.data;
    } catch (error) {
      console.error('Bulletin feed error:', error);
      throw error;
    }
  },

  toggleReaction: async (postId, emoji) => {
    try {
      const response = await apiClient.post(`/bulletin/${postId}/react`, { emoji });
      return response.data;
    } catch (error) {
      console.error('Bulletin react error:', error);
      throw error;
    }
  },
};

export default bulletinApi;
