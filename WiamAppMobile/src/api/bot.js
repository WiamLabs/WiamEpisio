import apiClient from './client';

const botApi = {
  /**
   * Send a message to WiamBot (JWT authenticated, daily limits apply)
   * @param {string} message - User message
   * @returns {{ message, links?, remaining_today, daily_limit }}
   */
  sendMessage: async (message) => {
    try {
      const response = await apiClient.post('/bot/chat', { message });
      return response.data;
    } catch (error) {
      // Pass through 429 rate limit errors with structured data
      if (error?.response?.status === 429) {
        const data = error.response.data;
        throw { rateLimited: true, ...data };
      }
      console.error('WiamBot chat error:', error);
      throw error;
    }
  },

  /**
   * Get WiamBot daily usage status
   * @returns {{ used_today, daily_limit, remaining_today, plan }}
   */
  getStatus: async () => {
    try {
      const response = await apiClient.get('/bot/status');
      return response.data;
    } catch (error) {
      console.error('WiamBot status error:', error);
      return { used_today: 0, daily_limit: 5, remaining_today: 5, plan: 'none' };
    }
  },

  /**
   * Get creator support templates
   */
  getTemplates: async () => {
    try {
      const response = await apiClient.get('/bot/templates');
      return response.data;
    } catch (error) {
      console.error('WiamBot templates error:', error);
      throw error;
    }
  },

  /**
   * Analyze manuscript text
   * @param {string} text - Manuscript text
   */
  analyzeManuscript: async (text) => {
    try {
      const response = await apiClient.post('/bot/analyze', { text });
      return response.data;
    } catch (error) {
      console.error('WiamBot analyze error:', error);
      throw error;
    }
  }
};

export default botApi;
