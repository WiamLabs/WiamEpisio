// © 2026 WiamApp. Powered by WiamLabs
// lib/locationWarning.js — Shown every time a user sets / changes GPS location

import { Alert } from 'react-native';

/**
 * role: 'customer' | 'worker' | 'business' | 'generic'
 * Returns true if user taps "Okay, I understand"
 */
export function confirmLocationSetup(role = 'generic') {
  let title = 'Set your service location';
  let message =
    'Use this only where you actually need or provide services.\n\n'
    + '• Customers: stand at your home / office / the place where the worker should come.\n'
    + '• Workers: stand at your base / workshop / the area you work from.\n\n'
    + 'Wrong location makes matching inaccurate. You can edit the city and landmark after GPS fills them.';

  if (role === 'customer') {
    title = 'Customer location tip';
    message =
      'Please be at your house, office, or the exact place where you will need the service.\n\n'
      + 'Workers are matched to this pin. If you are somewhere else right now, type your address instead of using GPS.';
  } else if (role === 'worker') {
    title = 'Worker base location tip';
    message =
      'Please be at your house, workshop, or the area you base from as a worker.\n\n'
      + 'Customers nearby will see you based on this pin. If you are travelling, type your base area instead of using GPS.';
  } else if (role === 'business') {
    title = 'Business location tip';
    message =
      'Please be at your business premises or the site where workers should report.\n\n'
      + 'If you are not there now, type the address instead of using GPS.';
  }

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Okay, I understand', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
