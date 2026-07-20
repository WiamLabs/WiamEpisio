import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'wiam_device_fingerprint_v1';

const randomId = () => {
  const a = Math.random().toString(36).slice(2, 10);
  const b = Date.now().toString(36);
  return `wf_${Platform.OS}_${a}_${b}`;
};

export const getDeviceFingerprint = async () => {
  try {
    let fp = await SecureStore.getItemAsync(KEY);
    if (!fp) {
      fp = randomId();
      await SecureStore.setItemAsync(KEY, fp);
    }
    return fp;
  } catch {
    return randomId();
  }
};

export default getDeviceFingerprint;
