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

export async function getAuthToken() {
  if (_cachedToken) return _cachedToken;
  try {
    const token = await SecureStore.getItemAsync(CONFIG.AUTH_TOKEN_KEY);
    if (token) _cachedToken = token;
    return token || null;
  } catch {
    return null;
  }
}

function attachAuthHeader(config, token) {
  if (!token) return config;
  const value = `Bearer ${token}`;
  if (!config.headers) {
    config.headers = { Authorization: value };
    return config;
  }
  if (typeof config.headers.set === 'function') {
    config.headers.set('Authorization', value);
  } else {
    config.headers.Authorization = value;
    config.headers.authorization = value;
  }
  return config;
}

// Request interceptor for adding the JWT token
apiClient.interceptors.request.use(
  async (config) => {
    // Allow callers to skip auto-attach (rare); otherwise always attach JWT.
    if (config.skipAuth) return config;
    const token = await getAuthToken();
    return attachAuthHeader(config, token);
  },
  (error) => Promise.reject(error),
);

// Response interceptor for handling common errors (like 401 Unauthorized)
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config || {};
    const status = error.response?.status;
    const method = (config.method || 'get').toLowerCase();
    const url = String(config.url || '');

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

    // Do not force-logout on account-delete failures — user needs to stay signed in to retry.
    const isDeleteAccount = url.includes('/auth/delete-account');
    if (error.response && error.response.status === 401 && !config.skipLogout && !isDeleteAccount) {
      _cachedToken = null;
      const { default: useAuthStore } = await import('../store/useAuthStore');
      const logout = useAuthStore.getState().logout;
      await logout();
    }
    if (!error.response && error.message === 'Network Error') {
      const base = error.config?.baseURL || CONFIG.API_URL;
      error.networkHint = `No response from ${base}. Use https://episio.wiamlabs.com/api/v1 (not wiamapp.com). On a phone, do not use localhost.`;
    }
    return Promise.reject(error);
  },
);

export default apiClient;
