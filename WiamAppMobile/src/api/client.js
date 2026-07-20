import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import CONFIG from '../constants/config';

const apiClient = axios.create({
  baseURL: CONFIG.API_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// In-memory token cache to avoid expensive SecureStore reads on every request
let _cachedToken = null;

export const setTokenCache = (token) => { _cachedToken = token; };
export const clearTokenCache = () => { _cachedToken = null; };

// Request interceptor for adding the JWT token
apiClient.interceptors.request.use(
  async (config) => {
    let token = _cachedToken;
    if (!token) {
      token = await SecureStore.getItemAsync(CONFIG.AUTH_TOKEN_KEY);
      if (token) _cachedToken = token;
    }
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling common errors (like 401 Unauthorized)
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const config = error.config;
    const status = error.response?.status;
    const method = (config?.method || 'get').toLowerCase();

    // Render/host cold starts often return one 502/503; retry safe reads only.
    const transientGateway = status === 502 || status === 503 || status === 504;
    const idempotent = method === 'get' || method === 'head';
    if (transientGateway && idempotent && config) {
      const n = config.__wiamGatewayRetry ?? 0;
      if (n < 3) {
        config.__wiamGatewayRetry = n + 1;
        await new Promise((r) => setTimeout(r, 450 + n * 550));
        return apiClient(config);
      }
    }

    if (error.response && error.response.status === 401) {
      _cachedToken = null;
      // Lazy-import to break require cycle (client → useAuthStore → iap → client)
      const { default: useAuthStore } = await import('../store/useAuthStore');
      const logout = useAuthStore.getState().logout;
      await logout();
    }
    if (!error.response && error.message === 'Network Error') {
      const base = error.config?.baseURL || CONFIG.API_URL;
      error.networkHint = `No response from ${base}. Use https://episio.wiamlabs.com/api/v1 (not wiamapp.com). On a phone, do not use localhost.`;
    }
    return Promise.reject(error);
  }
);

export default apiClient;
