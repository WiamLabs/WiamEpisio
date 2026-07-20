import { Platform, Vibration } from 'react-native';

/**
 * Thin haptic wrapper.
 *
 * expo-haptics requires a native dev-build and its native module cannot be
 * resolved in Expo Go with SDK 54.  To keep the app bundling cleanly we
 * lazy-load the module at RUNTIME via an async import() (which Metro does NOT
 * statically resolve) and fall back to a short Vibration buzz on Android.
 */

let _Haptics = null; // populated lazily
let _loaded = false;

const load = async () => {
  if (_loaded) return _Haptics;
  _loaded = true;
  try {
    _Haptics = await import('expo-haptics');
  } catch {
    _Haptics = null;
  }
  return _Haptics;
};

const safeImpact = async (styleName) => {
  if (Platform.OS === 'web') return;
  const H = await load();
  if (H) {
    try { await H.impactAsync(H.ImpactFeedbackStyle[styleName]); } catch {}
  } else if (Platform.OS === 'android') {
    Vibration.vibrate(10);
  }
};

const safeNotification = async (typeName) => {
  if (Platform.OS === 'web') return;
  const H = await load();
  if (H) {
    try { await H.notificationAsync(H.NotificationFeedbackType[typeName]); } catch {}
  } else if (Platform.OS === 'android') {
    Vibration.vibrate(15);
  }
};

/** Light tap – tab switches, toggles, minor selections. */
export const lightTap = () => { safeImpact('Light'); };

/** Medium tap – button presses, card taps, navigation actions. */
export const mediumTap = () => { safeImpact('Medium'); };

/** Heavy tap – destructive actions, important confirmations. */
export const heavyTap = () => { safeImpact('Heavy'); };

/** Success notification – purchase complete, chapter unlocked, etc. */
export const successNotification = () => { safeNotification('Success'); };

/** Warning notification – low balance, rate limit, etc. */
export const warningNotification = () => { safeNotification('Warning'); };

/** Error notification – failed action, network error, etc. */
export const errorNotification = () => { safeNotification('Error'); };

/** Selection tick – picker changes, slider steps. */
export const selectionTick = async () => {
  if (Platform.OS === 'web') return;
  const H = await load();
  if (H) {
    try { await H.selectionAsync(); } catch {}
  }
};
