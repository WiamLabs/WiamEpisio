import apiClient from './client';

const notificationsApi = {
  list: async (params = {}) => {
    const { data } = await apiClient.get('/notifications', { params });
    return data;
  },
  markRead: async (id) => {
    const { data } = await apiClient.post(`/notifications/${id}/read`);
    return data;
  },
  markAllRead: async () => {
    const { data } = await apiClient.post('/notifications/mark-all-read');
    return data;
  },
  clear: async () => {
    const { data } = await apiClient.delete('/notifications/clear');
    return data;
  },
};

export default notificationsApi;
