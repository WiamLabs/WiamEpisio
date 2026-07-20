import apiClient from './client';

const eliteApi = {
  getLeaderboard: () =>
    apiClient.get('/elite/leaderboard').then(r => r.data),

  getStoryDetail: (bookId) =>
    apiClient.get(`/elite/story/${bookId}`).then(r => r.data),
};

export default eliteApi;
