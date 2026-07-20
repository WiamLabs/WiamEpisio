/**
 * Expo Push Notifications — lazy-loads expo-notifications so Expo Go
 * does not spam SDK 53+ "remote notifications removed" errors.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';

let _pushToken = null;
let _Notifications = null;

function isExpoGo() {
  return (
    Constants.appOwnership === 'expo'
    || Constants.executionEnvironment === 'storeClient'
  );
}

async function getNotifications() {
  if (isExpoGo()) return null;
  if (_Notifications) return _Notifications;
  _Notifications = await import('expo-notifications');
  _Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
  return _Notifications;
}

export async function registerForPushNotifications() {
  if (Platform.OS === 'web' || isExpoGo()) {
    if (isExpoGo()) {
      console.log('[Push] Expo Go — push tokens need a development build. Skipping.');
    }
    return null;
  }

  try {
    const Device = await import('expo-device');
    if (!Device.isDevice) {
      console.log('[Push] Not a physical device — skipping');
      return null;
    }

    const Notifications = await getNotifications();
    if (!Notifications) return null;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('[Push] Permission not granted');
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId
      || Constants.easConfig?.projectId;

    let tokenData;
    try {
      tokenData = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );
    } catch (tokenErr) {
      console.warn('[Push] Could not get Expo push token:', tokenErr.message);
      return null;
    }
    _pushToken = tokenData.data;

    try {
      const { default: apiClient } = await import('../api/client');
      await apiClient.post('/push-token', {
        token: _pushToken,
        device_name: Device.deviceName || '',
        platform: Platform.OS,
      });
    } catch (err) {
      console.warn('[Push] Failed to register token with backend:', err.message);
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'WiamEpisio',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#D4A017',
        sound: 'default',
      });
    }

    return _pushToken;
  } catch (err) {
    console.warn('[Push] Registration error:', err?.message || err);
    return null;
  }
}

export function setupNotificationListeners(navigationRef) {
  if (isExpoGo()) {
    return () => {};
  }

  let cleanup = () => {};
  getNotifications().then((Notifications) => {
    if (!Notifications) return;

    const foregroundSub = Notifications.addNotificationReceivedListener(() => {});
    const responseSub = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data || {};
      try {
        const { default: trackingApi } = await import('../api/tracking');
        trackingApi.pushOpen(data.type || '', data.url || '');
      } catch { /* ignore */ }

      if (navigationRef?.current && data.type) {
        _handleNotificationNavigation(navigationRef.current, data);
      }
    });

    cleanup = () => {
      foregroundSub.remove();
      responseSub.remove();
    };
  }).catch(() => {});

  return () => cleanup();
}

function _handleNotificationNavigation(navigation, data) {
  const type = data.type || '';
  const url = data.url || '';

  if (type === 'new_episode' || type === 'series_live' || String(url).includes('/series/')) {
    const id = String(url).split('/series/')[1]?.split(/[/?]/)[0];
    if (id) {
      navigation.navigate('SeriesDetail', { seriesId: Number(id) });
      return;
    }
  }

  if (type === 'coins' || type === 'order_update') {
    navigation.navigate('BuyCoins');
    return;
  }

  if (type === 'creator_welcome') {
    navigation.navigate('StudioHome');
    return;
  }

  navigation.navigate('Notifications');
}

export async function unregisterPushToken() {
  if (!_pushToken) return;
  try {
    const { default: apiClient } = await import('../api/client');
    await apiClient.delete('/push-token', { data: { token: _pushToken } });
  } catch (err) {
    console.warn('[Push] Failed to unregister token:', err.message);
  }
  _pushToken = null;
}

export function getPushToken() {
  return _pushToken;
}

export async function getBadgeCount() {
  try {
    const Notifications = await getNotifications();
    if (!Notifications) return 0;
    return await Notifications.getBadgeCountAsync();
  } catch {
    return 0;
  }
}

export async function setBadgeCount(count) {
  try {
    const Notifications = await getNotifications();
    if (!Notifications) return;
    await Notifications.setBadgeCountAsync(count);
  } catch { /* ignore */ }
}
