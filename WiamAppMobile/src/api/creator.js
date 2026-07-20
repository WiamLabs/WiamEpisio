import apiClient from './client';

function formatAxiosError(error, fallback) {
  let msg =
    error.response?.data?.error ||
    error.message ||
    fallback;
  if (msg != null && typeof msg !== 'string') {
    try { msg = JSON.stringify(msg); } catch { msg = String(msg); }
  }
  const hint = error.networkHint ? `\n\n${error.networkHint}` : '';
  return `${msg || fallback}${hint}`;
}

const creatorApi = {
  getDashboard: async () => {
    try {
      const response = await apiClient.get('/creator/dashboard');
      return response.data;
    } catch (error) {
      throw formatAxiosError(error, 'Failed to fetch dashboard');
    }
  },

  getMyStories: async () => {
    try {
      const response = await apiClient.get('/creator/stories');
      return response.data;
    } catch (error) {
      throw formatAxiosError(error, 'Failed to fetch stories');
    }
  },

  getEarnings: async () => {
    try {
      const response = await apiClient.get('/creator/earnings');
      return response.data;
    } catch (error) {
      throw formatAxiosError(error, 'Failed to fetch earnings');
    }
  },

  getFollowers: async () => {
    try {
      const response = await apiClient.get('/creator/followers');
      return response.data;
    } catch (error) {
      throw formatAxiosError(error, 'Failed to fetch followers');
    }
  },

  toggleFollow: async (creatorId) => {
    try {
      const response = await apiClient.post(`/creators/${creatorId}/follow`);
      return response.data;
    } catch (error) {
      throw formatAxiosError(error, 'Failed to toggle follow');
    }
  },
};

export default creatorApi;
