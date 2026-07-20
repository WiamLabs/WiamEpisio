import React, { useEffect, useRef, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider as PaperProvider, MD3DarkTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import EpisioNavigator from './src/navigation/EpisioNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import { COLORS } from './src/constants/theme';
import { View, Text, Animated, StyleSheet, Dimensions } from 'react-native';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5,
    },
  },
});

const theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: COLORS.primary,
    secondary: COLORS.secondary,
    background: COLORS.background,
    surface: COLORS.surface,
  },
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BAR_WIDTH = SCREEN_WIDTH * 0.35;

function BrandedSplash() {
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const barOpacity = useRef(new Animated.Value(0)).current;
  const barFill = useRef(new Animated.Value(0)).current;
  const poweredOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(titleOpacity, { toValue: 1, duration: 500, delay: 200, useNativeDriver: true }),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(barOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(poweredOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.timing(barFill, { toValue: 1, duration: 2000, delay: 800, useNativeDriver: false }).start();
  }, []);

  const barWidth = barFill.interpolate({
    inputRange: [0, 0.3, 0.6, 1],
    outputRange: [0, BAR_WIDTH * 0.35, BAR_WIDTH * 0.7, BAR_WIDTH],
  });

  return (
    <View style={splashStyles.container}>
      <StatusBar style="light" />
      <View style={splashStyles.center}>
        <Animated.Text style={[splashStyles.title, { opacity: titleOpacity }]}>
          WiamEpisio
        </Animated.Text>
        <Animated.Text style={[splashStyles.tagline, { opacity: taglineOpacity }]}>
          African Vertical Drama
        </Animated.Text>
        <Animated.View style={[splashStyles.barTrack, { opacity: barOpacity }]}>
          <Animated.View style={[splashStyles.barFill, { width: barWidth }]} />
        </Animated.View>
      </View>
      <Animated.Text style={[splashStyles.powered, { opacity: poweredOpacity }]}>
        Powered by WiamLabs
      </Animated.Text>
    </View>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08081a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    alignItems: 'center',
  },
  title: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 34,
    color: '#e8e6e3',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: '#8e8e94',
    marginBottom: 26,
  },
  barTrack: {
    width: BAR_WIDTH,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#d4a843',
  },
  powered: {
    position: 'absolute',
    bottom: 40,
    fontSize: 11,
    color: '#555',
    letterSpacing: 0.5,
  },
});

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
  });

  /** Deterministic JS splash overlay so Expo Go users always see something branded. */
  const JS_SPLASH_MIN_MS = 2600;
  const startedAtRef = useRef(Date.now());
  const [showJsSplash, setShowJsSplash] = useState(true);

  useEffect(() => {
    if (!fontsLoaded && !fontError) return;
    const elapsed = Date.now() - startedAtRef.current;
    const wait = Math.max(0, JS_SPLASH_MIN_MS - elapsed);
    const t = setTimeout(() => {
      setShowJsSplash(false);
      SplashScreen.hideAsync().catch(() => {});
    }, wait);
    return () => clearTimeout(t);
  }, [fontsLoaded, fontError]);

  if (showJsSplash) {
    return <BrandedSplash />;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <PaperProvider theme={theme}>
          <SafeAreaProvider>
            <StatusBar style="light" />
            <EpisioNavigator />
          </SafeAreaProvider>
        </PaperProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
