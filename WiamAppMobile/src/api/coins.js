import apiClient from './client';

const coinsApi = {
  /**
   * Get current user coin balance
   */
  getBalance: async () => {
    try {
      const response = await apiClient.get('/coins/balance');
      return response.data;
    } catch (error) {
      console.warn('Get balance:', error?.message || error);
      return { balance: 0 };
    }
  },

  /**
   * Get available coin packages.
   * Pass currency (e.g. GHS, USD) for fair local display from USD base.
   */
  getPackages: async (currency) => {
    try {
      const params = currency ? { currency: String(currency).toUpperCase() } : {};
      const response = await apiClient.get('/coins/packages', { params });
      return response.data;
    } catch (error) {
      console.error('Get packages error:', error);
      throw error;
    }
  },

  /**
   * Initialize a coin purchase (Paystack)
   * @param {number} packageId - ID of the coin package
   */
  buyCoins: async (packageId) => {
    try {
      const response = await apiClient.post('/coins/initialize', { package_id: packageId });
      return response.data;
    } catch (error) {
      console.error('Buy coins error:', error);
      throw error;
    }
  },

  /**
   * Get coin transaction history
   */
  getTransactions: async () => {
    try {
      const response = await apiClient.get('/coins/history');
      return response.data;
    } catch (error) {
      console.error('Get transactions error:', error);
      throw error;
    }
  },

  /** Confirm Paystack purchase after browser return */
  verify: async (reference) => {
    try {
      const response = await apiClient.post('/coins/verify', { reference });
      return response.data;
    } catch (error) {
      console.error('Verify coins error:', error);
      throw error;
    }
  },

  /**
   * Unlock a chapter with coins
   * @param {number} bookId 
   * @param {number} chapterNumber 
   */
  unlockChapter: async (bookId, chapterNumber) => {
    try {
      const response = await apiClient.post('/coins/unlock', { content_id: bookId, chapter_number: chapterNumber });
      return response.data;
    } catch (error) {
      console.error('Unlock chapter error:', error);
      throw error;
    }
  }
};

export default coinsApi;
