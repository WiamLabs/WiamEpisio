import apiClient from './client';

const classicsApi = {
  list: (page = 1, genre = '') =>
    apiClient.get('/classics', { params: { page, genre } }).then(r => r.data),

  getDetail: (bookId) =>
    apiClient.get(`/classics/${bookId}`).then(r => r.data),
};

export default classicsApi;
