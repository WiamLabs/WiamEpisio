/**
 * Dynamic Expo config — extends app.json (do not duplicate static fields here).
 * API URL: EXPO_PUBLIC_API_URL in .env (local) or eas.json build profile env.
 */
const EPISIO_API = 'https://episio.wiamlabs.com/api/v1';

module.exports = ({ config }) => {
  let apiUrl = process.env.EXPO_PUBLIC_API_URL || config.extra?.apiUrl || EPISIO_API;
  // Jobs/marketing host is not the Episio Flask API
  if (/wiamapp\.com/i.test(apiUrl) && !/episio/i.test(apiUrl)) {
    apiUrl = EPISIO_API;
  }
  const rcAppleKey = process.env.EXPO_PUBLIC_RC_APPLE_KEY;
  const rcGoogleKey = process.env.EXPO_PUBLIC_RC_GOOGLE_KEY;
  const googleClientIdWeb = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  const googleClientIdIos = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS;
  const googleClientIdAndroid = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID;
  return {
    ...config,
    scheme: config.scheme || 'wiamapp',
    plugins: [...(config.plugins || []), 'expo-video'].filter(
      (p, i, arr) => arr.findIndex((x) => (Array.isArray(x) ? x[0] : x) === (Array.isArray(p) ? p[0] : p)) === i,
    ),
    extra: {
      ...(config.extra || {}),
      apiUrl,
      ...(rcAppleKey ? { rcAppleKey } : {}),
      ...(rcGoogleKey ? { rcGoogleKey } : {}),
      ...(googleClientIdWeb ? { googleClientIdWeb } : {}),
      ...(googleClientIdIos ? { googleClientIdIos } : {}),
      ...(googleClientIdAndroid ? { googleClientIdAndroid } : {}),
    },
  };
};
