import { Platform } from 'react-native';
import Constants from 'expo-constants';

let providerPrepared = false;
/** Lazily-loaded; null = Expo Go or module missing; never static-import — breaks Expo Go. */
let _AppIntegrity = undefined;

function getAppIntegrity() {
  if (_AppIntegrity !== undefined) return _AppIntegrity;
  // Expo Go does not ship the native ExpoAppIntegrity TurboModule.
  if (Constants.appOwnership === 'expo') {
    _AppIntegrity = null;
    return null;
  }
  try {
    _AppIntegrity = require('@expo/app-integrity');
  } catch {
    _AppIntegrity = null;
  }
  return _AppIntegrity;
}

const randomNonce = () => {
  const a = Math.random().toString(36).slice(2);
  const b = Date.now().toString(36);
  return `wpi_${b}_${a}`.slice(0, 64);
};

const unsupported = (reason) => ({
  play_integrity_token: null,
  ios_integrity_token: null,
  integrity_nonce: null,
  integrity_supported: false,
  reason,
});

/**
 * Fetch app integrity payload (Android Play Integrity / iOS App Attest).
 * Works in release / dev-client builds. Expo Go skips native integrity (no crash).
 */
export const getPlayIntegrityPayload = async (serverNonce = null) => {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return unsupported('unsupported_platform');
  }

  const AppIntegrity = getAppIntegrity();
  if (!AppIntegrity) {
    return unsupported(
      Constants.appOwnership === 'expo'
        ? 'expo_go'
        : 'native_module_unavailable'
    );
  }

  const nonce = serverNonce || randomNonce();

  if (Platform.OS === 'ios') {
    try {
      if (typeof AppIntegrity.getAttestationAsync === 'function') {
        const token = await AppIntegrity.getAttestationAsync(nonce);
        return {
          play_integrity_token: null,
          ios_integrity_token: token || null,
          integrity_nonce: nonce,
          integrity_supported: true,
          reason: token ? 'ok' : 'empty_ios_token',
        };
      }
      if (typeof AppIntegrity.requestIntegrityCheckAsync === 'function') {
        const token = await AppIntegrity.requestIntegrityCheckAsync(nonce);
        return {
          play_integrity_token: null,
          ios_integrity_token: token || null,
          integrity_nonce: nonce,
          integrity_supported: true,
          reason: token ? 'ok' : 'empty_ios_token',
        };
      }
      return unsupported('ios_integrity_api_unavailable');
    } catch (error) {
      return unsupported(String(error?.code || error?.message || 'ios_integrity_unavailable'));
    }
  }

  const cloudProjectNumber = process.env.EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER;
  if (!cloudProjectNumber || cloudProjectNumber.startsWith('REPLACE_ME')) {
    return unsupported('missing_cloud_project_number');
  }

  try {
    if (!providerPrepared) {
      await AppIntegrity.prepareIntegrityTokenProviderAsync(cloudProjectNumber);
      providerPrepared = true;
    }

    const token = await AppIntegrity.requestIntegrityCheckAsync(nonce);
    return {
      play_integrity_token: token || null,
      ios_integrity_token: null,
      integrity_nonce: nonce,
      integrity_supported: true,
      reason: token ? 'ok' : 'empty_token',
    };
  } catch (error) {
    const code = String(error?.code || '');

    if (code === 'ERR_APP_INTEGRITY_PROVIDER_INVALID') {
      try {
        await AppIntegrity.prepareIntegrityTokenProviderAsync(cloudProjectNumber);
        providerPrepared = true;
        const n = randomNonce();
        const token = await AppIntegrity.requestIntegrityCheckAsync(n);
        return {
          play_integrity_token: token || null,
          ios_integrity_token: null,
          integrity_nonce: n,
          integrity_supported: true,
          reason: token ? 'ok' : 'empty_token_after_retry',
        };
      } catch (retryError) {
        return unsupported(String(retryError?.code || retryError?.message || 'integrity_retry_failed'));
      }
    }

    return unsupported(String(error?.code || error?.message || 'integrity_unavailable'));
  }
};

export default getPlayIntegrityPayload;
