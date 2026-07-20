import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import CONFIG from '../constants/config';
import { setTokenCache, clearTokenCache } from '../api/client';
// iap & pushNotifications imported lazily to break require cycles
// (useAuthStore → iap → client → useAuthStore)
// (useAuthStore → pushNotifications → client → useAuthStore)

const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  postOnboardingPending: false,
  onboardingWelcomeCoins: 0,

  setAuth: async (user, token) => {
    try {
      if (token) {
        setTokenCache(token);
        await SecureStore.setItemAsync(CONFIG.AUTH_TOKEN_KEY, token);
        await SecureStore.setItemAsync(CONFIG.USER_DATA_KEY, JSON.stringify(user));
      }
      set({ user, token, isAuthenticated: !!token, isLoading: false });
      // Initialize RevenueCat on native platforms after login
      if (token && user?.wiam_id && Platform.OS !== 'web') {
        import('../services/iap').then(m => m.initIAP(user.wiam_id)).catch(() => {});
      }
      // Register for push notifications on native platforms
      if (token && Platform.OS !== 'web') {
        import('../services/pushNotifications').then(m => m.registerForPushNotifications()).catch(() => {});
      }
    } catch (error) {
      console.error('Error saving auth data', error);
    }
  },

  logout: async () => {
    try {
      clearTokenCache();
      await SecureStore.deleteItemAsync(CONFIG.AUTH_TOKEN_KEY);
      await SecureStore.deleteItemAsync(CONFIG.USER_DATA_KEY);
      if (Platform.OS !== 'web') {
        import('../services/iap').then(m => m.logoutIAP()).catch(() => {});
        import('../services/pushNotifications').then(m => m.unregisterPushToken()).catch(() => {});
      }
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    } catch (error) {
      console.error('Error clearing auth data', error);
    }
  },

  checkAuth: async () => {
    try {
      const token = await SecureStore.getItemAsync(CONFIG.AUTH_TOKEN_KEY);
      const userData = await SecureStore.getItemAsync(CONFIG.USER_DATA_KEY);
      
      if (token && userData) {
        setTokenCache(token);
        const parsed = JSON.parse(userData);
        set({
          user: parsed,
          token,
          isAuthenticated: true,
          isLoading: false,
        });
        // Refresh membership flags (email_verified, age_confirmed, privacy)
        import('../api/auth')
          .then((m) => m.default.me())
          .then((data) => {
            const u = data?.user || data;
            if (u && typeof u === 'object') get().patchUser(u);
          })
          .catch(() => {});
        // Initialize RevenueCat on app restart if user is logged in
        if (parsed?.wiam_id && Platform.OS !== 'web') {
          import('../services/iap').then(m => m.initIAP(parsed.wiam_id)).catch(() => {});
        }
        // Re-register push token on app restart
        if (Platform.OS !== 'web') {
          import('../services/pushNotifications').then(m => m.registerForPushNotifications()).catch(() => {});
        }
      } else {
        set({ user: null, token: null, isAuthenticated: false, isLoading: false });
      }
    } catch (error) {
      console.error('Error checking auth state', error);
      set({ isLoading: false });
    }
  },

  /** Merge fields into cached user (e.g. after /auth/me or creator application). Persists to SecureStore. */
  patchUser: async (partial) => {
    const prev = get().user;
    if (!prev || !partial || typeof partial !== 'object') return;
    const next = { ...prev, ...partial };
    set({ user: next });
    try {
      await SecureStore.setItemAsync(CONFIG.USER_DATA_KEY, JSON.stringify(next));
    } catch (error) {
      console.error('Error persisting user patch', error);
    }
  },

  queuePostOnboarding: (coins = 0) => {
    set({ postOnboardingPending: true, onboardingWelcomeCoins: Number(coins) || 0 });
  },

  clearPostOnboarding: () => {
    set({ postOnboardingPending: false, onboardingWelcomeCoins: 0 });
  },
}));

export default useAuthStore;
