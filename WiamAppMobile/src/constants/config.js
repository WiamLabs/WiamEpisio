import { Platform } from 'react-native';
import Constants from 'expo-constants';

/** Live WiamEpisio Flask API (Render via episio.wiamlabs.com). Not jobs wiamapp.com. */
const PROD_API_URL = 'https://episio.wiamlabs.com/api/v1';

function normalizeApiBase(url) {
  if (!url || typeof url !== 'string') return url;
  return url.replace(/\/+$/, '');
}

/**
 * Pick API base URL.
 * - Physical phones cannot reach your PC via "localhost" — use prod API unless .env sets LAN IP.
 * - Simulators/emulators: localhost or Android emulator host loopback.
 */
function resolveApiUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  const fromExtra = Constants.expoConfig?.extra?.apiUrl;
  let explicit = fromEnv || fromExtra;
  if (explicit) {
    explicit = normalizeApiBase(explicit.trim());
    // Never use marketing/jobs host for Episio API
    if (/wiamapp\.com/i.test(explicit) && !/episio/i.test(explicit)) {
      console.warn('[WiamEpisio] Ignoring wiamapp.com API URL — using episio.wiamlabs.com');
      explicit = null;
    }
    if (__DEV__ && Constants.isDevice) {
      const low = explicit?.toLowerCase() || '';
      if (
        low.includes('localhost') ||
        low.includes('127.0.0.1') ||
        low.includes('10.0.2.2')
      ) {
        console.warn(
          '[WiamEpisio] EXPO_PUBLIC_API_URL uses loopback on a physical device — using production API.',
          explicit,
        );
        explicit = null;
      }
    }
    if (explicit) return explicit;
  }

  if (!__DEV__) return PROD_API_URL;

  // Dev default: production Episio API (Render). Override with LAN IP if testing local Flask.
  if (Platform.OS === 'android' && process.env.EXPO_PUBLIC_USE_LOCAL_API === '1') {
    return 'http://10.0.2.2:8080/api/v1';
  }
  return PROD_API_URL;
}

const CONFIG = {
  API_URL: resolveApiUrl(),
  APP_NAME: 'WiamEpisio',
  VERSION: '1.0.0',
  AUTH_TOKEN_KEY: 'wiamapp_auth_token',
  USER_DATA_KEY: 'wiamapp_user_data',
  DEBUG: __DEV__,
  SITE_ORIGIN: 'https://episio.wiamlabs.com',
  LEGAL_ORIGIN: 'https://wiamapp.com',
};

if (__DEV__) {
  // eslint-disable-next-line no-console
  console.log('[WiamEpisio] Resolved API_URL:', CONFIG.API_URL);
}

export default CONFIG;
