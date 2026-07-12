// © 2026 WiamApp. Powered by WiamLabs
// Safe bootloader — hides native splash FIRST, then loads the real app.
// If the real app crashes on import, you see an error instead of a frozen logo.

import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as ExpoSplashScreen from 'expo-splash-screen';

const NAVY = '#08081A';
const GOLD = '#D4A017';

export default function App() {
  const [ReadyApp, setReadyApp] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Always dismiss native splash immediately so we never freeze on the logo
      try {
        await ExpoSplashScreen.hideAsync();
      } catch (_) {}

      try {
        // Dynamic require so import crashes become catchable errors
        // eslint-disable-next-line global-require
        const mod = require('./AppRoot');
        if (!cancelled) setReadyApp(() => mod.default);
      } catch (e) {
        console.error('WiamApp failed to load AppRoot:', e);
        if (!cancelled) setError(e);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 12, textAlign: 'center' }}>
            WiamApp failed to start
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
            {String(error?.message || error)}
          </Text>
          <Text style={{ color: GOLD, fontSize: 12, marginTop: 20, textAlign: 'center' }}>
            Screenshot this screen and send it to the WiamLabs team.
          </Text>
        </View>
      </SafeAreaProvider>
    );
  }

  if (!ReadyApp) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={GOLD} size="large" />
          <Text style={{ color: 'rgba(255,255,255,0.55)', marginTop: 16, fontSize: 14 }}>
            Starting WiamApp…
          </Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return <ReadyApp />;
}
