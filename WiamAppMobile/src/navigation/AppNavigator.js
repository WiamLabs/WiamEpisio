import React, { useEffect, useRef } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SplashScreen from 'expo-splash-screen';
import { setupNotificationListeners } from '../services/pushNotifications';
import useAuthStore from '../store/useAuthStore';
import AuthNavigator from './AuthNavigator';
import DrawerNavigator from './DrawerNavigator';
import BookDetailScreen from '../screens/content/BookDetailScreen';
import ReaderScreen from '../screens/content/ReaderScreen';
import WiamBotScreen from '../screens/main/WiamBotScreen';
import WalletScreen from '../screens/main/WalletScreen';
import BulletinScreen from '../screens/main/BulletinScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import GiftsScreen from '../screens/main/GiftsScreen';
import CoinHistoryScreen from '../screens/main/CoinHistoryScreen';
import TipHistoryScreen from '../screens/main/TipHistoryScreen';
import ProgramsScreen from '../screens/main/ProgramsScreen';
import ReadingStreaksScreen from '../screens/main/ReadingStreaksScreen';
import ScheduleScreen from '../screens/main/ScheduleScreen';
import FeedbackScreen from '../screens/main/FeedbackScreen';
import AccountSafetyScreen from '../screens/main/AccountSafetyScreen';
import HelpCenterScreen from '../screens/main/HelpCenterScreen';
import CareersScreen from '../screens/main/CareersScreen';
import CreatorProfileScreen from '../screens/content/CreatorProfileScreen';
import ApplyScreen from '../screens/creator/ApplyScreen';
import WelcomeCreatorScreen from '../screens/creator/WelcomeCreatorScreen';
import GlobalSearchScreen from '../screens/main/GlobalSearchScreen';
import ReadingListDetailScreen from '../screens/main/ReadingListDetailScreen';
import ReaderStatsScreen from '../screens/main/ReaderStatsScreen';
import PremiumTabScreen from '../screens/main/PremiumTabScreen';
import WiamEliteScreen from '../screens/main/WiamEliteScreen';
import ClassicsScreen from '../screens/main/ClassicsScreen';
import CreatorSubscriptionScreen from '../screens/main/CreatorSubscriptionScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import OfflineReadingScreen from '../screens/main/OfflineReadingScreen';
import UniverseDetailScreen from '../screens/content/UniverseDetailScreen';
import SeriesDetailScreen from '../screens/content/SeriesDetailScreen';
import StudioNavigator from './StudioNavigator';
import OnboardingFlowScreen from '../screens/auth/OnboardingFlowScreen';
import RegistrationFinishScreen from '../screens/auth/RegistrationFinishScreen';
import PostOnboardingNavigator from './PostOnboardingNavigator';
import { COLORS } from '../constants/theme';
import linking from './linking';
import CONFIG from '../constants/config';

const DarkNavTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background: COLORS.background,
    card: COLORS.background,
    text: COLORS.text,
    border: COLORS.border,
    primary: COLORS.secondary,
  },
};

const Stack = createNativeStackNavigator();

/** Minimum time native splash stays up so it’s visible (fonts + SecureStore are fast). */
const MIN_SPLASH_MS = 900;

const AppNavigator = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const checkAuth = useAuthStore((s) => s.checkAuth);
  const user = useAuthStore((s) => s.user);
  const postOnboardingPending = useAuthStore((s) => s.postOnboardingPending === true);
  /** Remount stack when signup phase changes so an old tree (e.g. legacy onboarding) cannot linger. */
  const authPhaseKey = !isAuthenticated
    ? 'phase_guest'
    : user?.registration_completed === false
      ? 'phase_registration_finish'
      : !user?.onboarding_completed
        ? 'phase_onboarding'
        : postOnboardingPending
          ? 'phase_post_onboarding'
          : 'phase_app';
  const appOpenedAt = useRef(Date.now());
  const splashHidden = useRef(false);
  const navigationRef = useRef(null);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Keep-alive ping — wake Render.com free tier server on app start & every 10 min
  useEffect(() => {
    const baseUrl = (CONFIG.API_URL || '').replace(/\/api\/v1\/?$/, '');
    const ping = () => { fetch(`${baseUrl}/api/v1/health`).catch(() => {}); };
    ping(); // immediate wake-up
    const iv = setInterval(ping, 10 * 60 * 1000);
    return () => clearInterval(iv);
  }, []);

  // Set up push notification listeners (tap-to-navigate)
  useEffect(() => {
    if (!isAuthenticated) return;
    const cleanup = setupNotificationListeners(navigationRef);
    return cleanup;
  }, [isAuthenticated]);

  useEffect(() => {
    if (isLoading) return;
    if (splashHidden.current) return;

    const elapsed = Date.now() - appOpenedAt.current;
    const wait = Math.max(0, MIN_SPLASH_MS - elapsed);
    const t = setTimeout(() => {
      splashHidden.current = true;
      SplashScreen.hideAsync().catch(() => {});
    }, wait);
    return () => clearTimeout(t);
  }, [isLoading]);

  // While auth hydrates from SecureStore, keep native splash (don’t flash a spinner).
  if (isLoading) {
    return null;
  }

  return (
    <NavigationContainer ref={navigationRef} linking={linking} theme={DarkNavTheme}>
      <Stack.Navigator
        key={authPhaseKey}
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.background }, animation: 'slide_from_right' }}
      >
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : user?.registration_completed === false ? (
          <Stack.Screen
            name="RegistrationFinish"
            component={RegistrationFinishScreen}
            options={{ headerShown: false, gestureEnabled: false }}
          />
        ) : !user?.onboarding_completed ? (
          <Stack.Screen
            name="Onboarding"
            component={OnboardingFlowScreen}
            options={{ headerShown: false, gestureEnabled: false }}
          />
        ) : postOnboardingPending ? (
          <Stack.Screen
            name="PostOnboarding"
            component={PostOnboardingNavigator}
            options={{ headerShown: false, gestureEnabled: false }}
          />
        ) : (
          <>
            <Stack.Screen name="Main" component={DrawerNavigator} />
            <Stack.Screen 
              name="BookDetail" 
              component={BookDetailScreen} 
              options={{ 
                headerShown: false
              }} 
            />
            <Stack.Screen 
              name="Reader" 
              component={ReaderScreen} 
              options={{ 
                headerShown: false,
                animation: 'slide_from_right'
              }} 
            />
            <Stack.Screen 
              name="WiamBot" 
              component={WiamBotScreen} 
              options={{ 
                headerShown: false,
                animation: 'slide_from_right'
              }} 
            />
            <Stack.Screen 
              name="Wallet" 
              component={WalletScreen} 
              options={{ 
                headerShown: false,
                animation: 'slide_from_bottom'
              }} 
            />
            <Stack.Screen 
              name="Bulletin" 
              component={BulletinScreen} 
              options={{ 
                headerShown: false,
                animation: 'slide_from_right'
              }} 
            />
            <Stack.Screen 
              name="Notifications" 
              component={NotificationsScreen} 
              options={{ 
                headerShown: false,
                animation: 'slide_from_right'
              }} 
            />
            <Stack.Screen 
              name="Gifts" 
              component={GiftsScreen} 
              options={{ 
                headerShown: false,
                animation: 'slide_from_right'
              }} 
            />
            <Stack.Screen 
              name="CoinHistory" 
              component={CoinHistoryScreen} 
              options={{ 
                headerShown: false,
                animation: 'slide_from_right'
              }} 
            />
            <Stack.Screen 
              name="TipHistory" 
              component={TipHistoryScreen} 
              options={{ 
                headerShown: false,
                animation: 'slide_from_right'
              }} 
            />
            <Stack.Screen 
              name="Programs" 
              component={ProgramsScreen} 
              options={{ 
                headerShown: false,
                animation: 'slide_from_right'
              }} 
            />
            <Stack.Screen 
              name="Schedule" 
              component={ScheduleScreen} 
              options={{ 
                headerShown: false,
                animation: 'slide_from_right'
              }} 
            />
            <Stack.Screen 
              name="ReadingStreaks" 
              component={ReadingStreaksScreen} 
              options={{ 
                headerShown: false,
                animation: 'slide_from_right'
              }} 
            />
            <Stack.Screen 
              name="Feedback" 
              component={FeedbackScreen} 
              options={{ 
                headerShown: false,
                animation: 'slide_from_right'
              }} 
            />
            <Stack.Screen 
              name="AccountSafety" 
              component={AccountSafetyScreen} 
              options={{ 
                headerShown: false,
                animation: 'slide_from_right'
              }} 
            />
            <Stack.Screen 
              name="HelpCenter" 
              component={HelpCenterScreen} 
              options={{ 
                headerShown: false,
                animation: 'slide_from_right'
              }} 
            />
            <Stack.Screen 
              name="Careers" 
              component={CareersScreen} 
              options={{ 
                headerShown: false,
                animation: 'slide_from_right'
              }} 
            />
            <Stack.Screen 
              name="CreatorProfile" 
              component={CreatorProfileScreen} 
              options={{ 
                headerShown: false,
                animation: 'slide_from_right'
              }} 
            />
            <Stack.Screen 
              name="Apply" 
              component={ApplyScreen} 
              options={{ 
                headerShown: false,
                animation: 'slide_from_right'
              }} 
            />
            <Stack.Screen
              name="WelcomeCreator"
              component={WelcomeCreatorScreen}
              options={{
                headerShown: false,
                animation: 'slide_from_bottom',
                gestureEnabled: false,
              }}
            />
            <Stack.Screen 
              name="PremiumScreen" 
              component={PremiumTabScreen} 
              options={{ 
                headerShown: false,
                animation: 'slide_from_bottom'
              }} 
            />
            <Stack.Screen 
              name="GlobalSearch" 
              component={GlobalSearchScreen} 
              options={{ 
                headerShown: false,
                animation: 'fade'
              }} 
            />
            <Stack.Screen 
              name="ReadingListDetail" 
              component={ReadingListDetailScreen} 
              options={{ 
                headerShown: false,
                animation: 'slide_from_right'
              }} 
            />
            <Stack.Screen 
              name="ReaderStats" 
              component={ReaderStatsScreen} 
              options={{ 
                headerShown: false,
                animation: 'slide_from_right'
              }} 
            />
            <Stack.Screen 
              name="WiamElite" 
              component={WiamEliteScreen} 
              options={{ 
                headerShown: false,
                animation: 'slide_from_right'
              }} 
            />
            <Stack.Screen 
              name="Classics" 
              component={ClassicsScreen} 
              options={{ 
                headerShown: false,
                animation: 'slide_from_right'
              }} 
            />
            <Stack.Screen 
              name="CreatorSubscription" 
              component={CreatorSubscriptionScreen} 
              options={{ 
                headerShown: false,
                animation: 'slide_from_bottom'
              }} 
            />
            <Stack.Screen 
              name="Settings" 
              component={SettingsScreen} 
              options={{ 
                headerShown: false,
                animation: 'slide_from_right'
              }} 
            />
            <Stack.Screen
              name="OfflineReading"
              component={OfflineReadingScreen}
              options={{
                headerShown: false,
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="UniverseDetail"
              component={UniverseDetailScreen}
              options={{
                headerShown: false,
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="SeriesDetail"
              component={SeriesDetailScreen}
              options={{
                headerShown: false,
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="Studio"
              component={StudioNavigator}
              options={{
                headerShown: false,
                animation: 'slide_from_right',
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
