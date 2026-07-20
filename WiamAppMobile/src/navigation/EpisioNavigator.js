/**
 * WiamEpisio root navigation — only screens already built from Martin's HTML pack.
 * Guest can browse Watch Home; auth / Studio / wallet are stack modals.
 */
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as SplashScreen from 'expo-splash-screen';
import useAuthStore from '../store/useAuthStore';
import { COLORS } from '../constants/theme';
import BottomTabBar from '../components/episio/BottomTabBar';
import { setupNotificationListeners } from '../services/pushNotifications';
import CONFIG from '../constants/config';

import SplashScreenUI from '../screens/episio/SplashScreen';
import SplashReturningScreen from '../screens/episio/SplashReturningScreen';
import OnboardingWelcomeScreen from '../screens/episio/OnboardingWelcomeScreen';
import OnboardingGenresScreen from '../screens/episio/OnboardingGenresScreen';
import OnboardingDoneScreen from '../screens/episio/OnboardingDoneScreen';
import WelcomeBonusScreen from '../screens/episio/WelcomeBonusScreen';
import AgeGateScreen from '../screens/episio/AgeGateScreen';
import OtpVerifyScreen from '../screens/episio/OtpVerifyScreen';
import ResetPasswordScreen from '../screens/episio/ResetPasswordScreen';
import HomeScreen from '../screens/episio/HomeScreen';
import DiscoverScreen from '../screens/episio/DiscoverScreen';
import MembershipScreen from '../screens/episio/MembershipScreen';
import MyListScreen from '../screens/episio/MyListScreen';
import ProfileScreen from '../screens/episio/ProfileScreen';
import SeriesDetailScreen from '../screens/episio/SeriesDetailScreen';
import PlayerScreen from '../screens/episio/PlayerScreen';
import TrailerPlayerScreen from '../screens/episio/TrailerPlayerScreen';
import UnlockTakeoverScreen from '../screens/episio/UnlockTakeoverScreen';
import SearchScreen from '../screens/episio/SearchScreen';
import ShelfScreen from '../screens/episio/ShelfScreen';
import LoginScreen from '../screens/episio/LoginScreen';
import AuthRegisterScreen from '../screens/episio/AuthRegisterScreen';
import ForgotPasswordScreen from '../screens/episio/ForgotPasswordScreen';
import BuyCoinsScreen from '../screens/episio/BuyCoinsScreen';
import TransactionHistoryScreen from '../screens/episio/TransactionHistoryScreen';
import DailyRewardsScreen from '../screens/episio/DailyRewardsScreen';
import NotificationsScreen from '../screens/episio/NotificationsScreen';
import SettingsScreen from '../screens/episio/SettingsScreen';
import HelpCenterScreen from '../screens/episio/HelpCenterScreen';
import CreatorApplyScreen from '../screens/episio/CreatorApplyScreen';
import CreatorApplyInviteOnlyScreen from '../screens/episio/CreatorApplyInviteOnlyScreen';
import CreatorTrustTierScreen from '../screens/episio/CreatorTrustTierScreen';
import StudioHomeScreen from '../screens/episio/StudioHomeScreen';
import StudioSeriesCreateScreen from '../screens/episio/StudioSeriesCreateScreen';
import StudioSeriesDetailScreen from '../screens/episio/StudioSeriesDetailScreen';
import StudioSpecsScreen from '../screens/episio/StudioSpecsScreen';
import StudioSeasonLockScreen from '../screens/episio/StudioSeasonLockScreen';
import StudioCompletenessScreen from '../screens/episio/StudioCompletenessScreen';
import StudioSoftInterestScreen from '../screens/episio/StudioSoftInterestScreen';
import StudioSubmitForLiveScreen from '../screens/episio/StudioSubmitForLiveScreen';
import StudioLiveSuccessScreen from '../screens/episio/StudioLiveSuccessScreen';
import StudioEpisodeListScreen from '../screens/episio/StudioEpisodeListScreen';
import StudioEpisodeDetailScreen from '../screens/episio/StudioEpisodeDetailScreen';
import StudioEpisodeUploadScreen from '../screens/episio/StudioEpisodeUploadScreen';
import StudioEpisodeRejectScreen from '../screens/episio/StudioEpisodeRejectScreen';
import StudioTrailerScreen from '../screens/episio/StudioTrailerScreen';
import StudioNeedsChangesScreen from '../screens/episio/StudioNeedsChangesScreen';
import StudioSubmitPendingScreen from '../screens/episio/StudioSubmitPendingScreen';
import StudioRevisionRequestScreen from '../screens/episio/StudioRevisionRequestScreen';
import StudioAnalyticsScreen from '../screens/episio/StudioAnalyticsScreen';
import StudioEarningsScreen from '../screens/episio/StudioEarningsScreen';
import StudioHelpQualityScreen from '../screens/episio/StudioHelpQualityScreen';
import StudioTeaserPreviewScreen from '../screens/episio/StudioTeaserPreviewScreen';
import StudioPayoutKycScreen from '../screens/episio/StudioPayoutKycScreen';
import StudioCoverScreen from '../screens/episio/StudioCoverScreen';
import StudioBannerScreen from '../screens/episio/StudioBannerScreen';
import StudioSettingsScreen from '../screens/episio/StudioSettingsScreen';
import StudioDashboardScreen from '../screens/episio/StudioDashboardScreen';
import CreatorApplyAcceptedScreen from '../screens/episio/CreatorApplyAcceptedScreen';
import CreatorApplyRejectedScreen from '../screens/episio/CreatorApplyRejectedScreen';
import CreatorPublicProfileScreen from '../screens/episio/CreatorPublicProfileScreen';
import EditProfileScreen from '../screens/episio/EditProfileScreen';
import ShareSheetScreen from '../screens/episio/ShareSheetScreen';
import RateSeriesScreen from '../screens/episio/RateSeriesScreen';
import SeriesCommentsScreen from '../screens/episio/SeriesCommentsScreen';
import UnlockSuccessScreen from '../screens/episio/UnlockSuccessScreen';
import CoinsSuccessScreen from '../screens/episio/CoinsSuccessScreen';
import CheckoutWebScreen from '../screens/episio/CheckoutWebScreen';
import VipCheckoutScreen from '../screens/episio/VipCheckoutScreen';
import SearchNoResultsScreen from '../screens/episio/SearchNoResultsScreen';
import PaymentMethodPickerScreen from '../screens/episio/PaymentMethodPickerScreen';
import RemindersScreen from '../screens/episio/RemindersScreen';
import WatchHistoryScreen from '../screens/episio/WatchHistoryScreen';
import DownloadsManagerScreen from '../screens/episio/DownloadsManagerScreen';
import InviteFriendsScreen from '../screens/episio/InviteFriendsScreen';
import GiftCoinsScreen from '../screens/episio/GiftCoinsScreen';
import NextSuggestionScreen from '../screens/episio/NextSuggestionScreen';
import WiamOriginIntroScreen from '../screens/episio/WiamOriginIntroScreen';
import MembershipOfferModalScreen from '../screens/episio/MembershipOfferModalScreen';
import EpisodeListSheetScreen from '../screens/episio/EpisodeListSheetScreen';
import MyListChooseModeScreen from '../screens/episio/MyListChooseModeScreen';
import CurrencyNoteScreen from '../screens/episio/CurrencyNoteScreen';
import FollowSuccessScreen from '../screens/episio/FollowSuccessScreen';
import CreatorViewerSwitchScreen from '../screens/episio/CreatorViewerSwitchScreen';
import PlayerFullscreenScreen from '../screens/episio/PlayerFullscreenScreen';
import PlayerErrorScreen from '../screens/episio/PlayerErrorScreen';
import EpisodeAutoplayCountdownScreen from '../screens/episio/EpisodeAutoplayCountdownScreen';
import SearchFiltersSortScreen from '../screens/episio/SearchFiltersSortScreen';
import SubtitleSettingsScreen from '../screens/episio/SubtitleSettingsScreen';
import LanguagePickerScreen from '../screens/episio/LanguagePickerScreen';
import LoginRequiredSheetScreen from '../screens/episio/LoginRequiredSheetScreen';
import PushPermissionPromptScreen from '../screens/episio/PushPermissionPromptScreen';
import ReportContentScreen from '../screens/episio/ReportContentScreen';
import BlockCreatorScreen from '../screens/episio/BlockCreatorScreen';
import AccountDeleteScreen from '../screens/episio/AccountDeleteScreen';
import DeviceLimitScreen from '../screens/episio/DeviceLimitScreen';
import ForceUpdateScreen from '../screens/episio/ForceUpdateScreen';
import OfflineScreen from '../screens/episio/OfflineScreen';
import MaintenanceScreen from '../screens/episio/MaintenanceScreen';
import EmptyCatalogScreen from '../screens/episio/EmptyCatalogScreen';
import AboutScreen from '../screens/episio/AboutScreen';
import LegalPrivacyTermsScreen from '../screens/episio/LegalPrivacyTermsScreen';
import ConfirmDialogScreen from '../screens/episio/ConfirmDialogScreen';
import ToastSuccessScreen from '../screens/episio/ToastSuccessScreen';
import ToastErrorScreen from '../screens/episio/ToastErrorScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const NavTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background: COLORS.navy,
    card: COLORS.navy,
    text: COLORS.text,
    border: COLORS.navyLine,
    primary: COLORS.gold,
  },
};

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="Discover" component={DiscoverScreen} options={{ tabBarLabel: 'Discover' }} />
      <Tab.Screen name="Member" component={MembershipScreen} options={{ tabBarLabel: 'Member' }} />
      <Tab.Screen name="MyList" component={MyListScreen} options={{ tabBarLabel: 'My List' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}

const EpisioNavigator = () => {
  const isLoading = useAuthStore((s) => s.isLoading);
  const checkAuth = useAuthStore((s) => s.checkAuth);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const navigationRef = React.useRef(null);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const base = (CONFIG.API_URL || '').replace(/\/api\/v1\/?$/, '');
    const ping = () => { fetch(`${base}/api/v1/health`).catch(() => {}); };
    ping();
    const iv = setInterval(ping, 10 * 60 * 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    return setupNotificationListeners(navigationRef);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={COLORS.gold} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} theme={NavTheme}>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.navy },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Splash" component={SplashScreenUI} options={{ animation: 'fade' }} />
        <Stack.Screen name="SplashReturning" component={SplashReturningScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="OnboardingWelcome" component={OnboardingWelcomeScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="OnboardingGenres" component={OnboardingGenresScreen} />
        <Stack.Screen name="OnboardingDone" component={OnboardingDoneScreen} />
        <Stack.Screen name="WelcomeBonus" component={WelcomeBonusScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="AgeGate" component={AgeGateScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Main" component={MainTabs} options={{ animation: 'fade' }} />

        <Stack.Screen name="SeriesDetail" component={SeriesDetailScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="Player" component={PlayerScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="TrailerPlayer" component={TrailerPlayerScreen} />
        <Stack.Screen name="UnlockTakeover" component={UnlockTakeoverScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen name="Shelf" component={ShelfScreen} />

        <Stack.Screen name="Login" component={LoginScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="AuthRegister" component={AuthRegisterScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ presentation: 'modal' }} />

        <Stack.Screen name="BuyCoins" component={BuyCoinsScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="TransactionHistory" component={TransactionHistoryScreen} />
        <Stack.Screen name="DailyRewards" component={DailyRewardsScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />

        <Stack.Screen name="CreatorApply" component={CreatorApplyScreen} />
        <Stack.Screen name="CreatorApplyInviteOnly" component={CreatorApplyInviteOnlyScreen} />
        <Stack.Screen name="CreatorApplyAccepted" component={CreatorApplyAcceptedScreen} />
        <Stack.Screen name="CreatorApplyRejected" component={CreatorApplyRejectedScreen} />
        <Stack.Screen name="CreatorTrustTier" component={CreatorTrustTierScreen} />
        <Stack.Screen name="StudioHome" component={StudioHomeScreen} />
        <Stack.Screen name="StudioSeriesCreate" component={StudioSeriesCreateScreen} />
        <Stack.Screen name="StudioSeriesDetail" component={StudioSeriesDetailScreen} />
        <Stack.Screen name="StudioSpecs" component={StudioSpecsScreen} />
        <Stack.Screen name="StudioCompleteness" component={StudioCompletenessScreen} />
        <Stack.Screen name="StudioSeasonLock" component={StudioSeasonLockScreen} />
        <Stack.Screen name="StudioSoftInterest" component={StudioSoftInterestScreen} />
        <Stack.Screen name="StudioSubmitForLive" component={StudioSubmitForLiveScreen} />
        <Stack.Screen name="StudioSubmitPending" component={StudioSubmitPendingScreen} />
        <Stack.Screen name="StudioNeedsChanges" component={StudioNeedsChangesScreen} />
        <Stack.Screen name="StudioLiveSuccess" component={StudioLiveSuccessScreen} />
        <Stack.Screen name="StudioEpisodeList" component={StudioEpisodeListScreen} />
        <Stack.Screen name="StudioEpisodeDetail" component={StudioEpisodeDetailScreen} />
        <Stack.Screen name="StudioEpisodeUpload" component={StudioEpisodeUploadScreen} />
        <Stack.Screen name="StudioEpisodeReject" component={StudioEpisodeRejectScreen} />
        <Stack.Screen name="StudioTrailer" component={StudioTrailerScreen} />
        <Stack.Screen name="StudioRevisionRequest" component={StudioRevisionRequestScreen} />
        <Stack.Screen name="StudioAnalytics" component={StudioAnalyticsScreen} />
        <Stack.Screen name="StudioEarnings" component={StudioEarningsScreen} />
        <Stack.Screen name="StudioHelpQuality" component={StudioHelpQualityScreen} />
        <Stack.Screen name="StudioTeaserPreview" component={StudioTeaserPreviewScreen} />
        <Stack.Screen name="StudioPayoutKyc" component={StudioPayoutKycScreen} />
        <Stack.Screen name="StudioCover" component={StudioCoverScreen} />
        <Stack.Screen name="StudioBanner" component={StudioBannerScreen} />
        <Stack.Screen name="StudioSettings" component={StudioSettingsScreen} />
        <Stack.Screen name="StudioDashboard" component={StudioDashboardScreen} />

        <Stack.Screen name="CreatorPublicProfile" component={CreatorPublicProfileScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="ShareSheet" component={ShareSheetScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="RateSeries" component={RateSeriesScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="SeriesComments" component={SeriesCommentsScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="UnlockSuccess" component={UnlockSuccessScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="CoinsSuccess" component={CoinsSuccessScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="CheckoutWeb" component={CheckoutWebScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="VipCheckout" component={VipCheckoutScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="SearchNoResults" component={SearchNoResultsScreen} />
        <Stack.Screen name="PaymentMethodPicker" component={PaymentMethodPickerScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Reminders" component={RemindersScreen} />
        <Stack.Screen name="WatchHistory" component={WatchHistoryScreen} />
        <Stack.Screen name="DownloadsManager" component={DownloadsManagerScreen} />
        <Stack.Screen name="InviteFriends" component={InviteFriendsScreen} />
        <Stack.Screen name="GiftCoins" component={GiftCoinsScreen} />
        <Stack.Screen name="NextSuggestion" component={NextSuggestionScreen} />
        <Stack.Screen name="WiamOriginIntro" component={WiamOriginIntroScreen} />
        <Stack.Screen name="MembershipOfferModal" component={MembershipOfferModalScreen} options={{ presentation: 'transparentModal', animation: 'fade' }} />
        <Stack.Screen name="EpisodeListSheet" component={EpisodeListSheetScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="MyListChooseMode" component={MyListChooseModeScreen} />
        <Stack.Screen name="CurrencyNote" component={CurrencyNoteScreen} />
        <Stack.Screen name="FollowSuccess" component={FollowSuccessScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="CreatorViewerSwitch" component={CreatorViewerSwitchScreen} />
        <Stack.Screen name="PlayerFullscreen" component={PlayerFullscreenScreen} />
        <Stack.Screen name="PlayerError" component={PlayerErrorScreen} />
        <Stack.Screen name="EpisodeAutoplayCountdown" component={EpisodeAutoplayCountdownScreen} options={{ presentation: 'modal', animation: 'fade' }} />
        <Stack.Screen name="SearchFiltersSort" component={SearchFiltersSortScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="SubtitleSettings" component={SubtitleSettingsScreen} />
        <Stack.Screen name="LanguagePicker" component={LanguagePickerScreen} />
        <Stack.Screen name="LoginRequiredSheet" component={LoginRequiredSheetScreen} options={{ presentation: 'transparentModal', animation: 'fade' }} />
        <Stack.Screen name="PushPermissionPrompt" component={PushPermissionPromptScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="ReportContent" component={ReportContentScreen} />
        <Stack.Screen name="BlockCreator" component={BlockCreatorScreen} />
        <Stack.Screen name="AccountDelete" component={AccountDeleteScreen} />
        <Stack.Screen name="DeviceLimit" component={DeviceLimitScreen} />
        <Stack.Screen name="ForceUpdate" component={ForceUpdateScreen} />
        <Stack.Screen name="Offline" component={OfflineScreen} />
        <Stack.Screen name="Maintenance" component={MaintenanceScreen} />
        <Stack.Screen name="EmptyCatalog" component={EmptyCatalogScreen} />
        <Stack.Screen name="About" component={AboutScreen} />
        <Stack.Screen name="LegalPrivacyTerms" component={LegalPrivacyTermsScreen} />
        <Stack.Screen name="ConfirmDialog" component={ConfirmDialogScreen} options={{ presentation: 'transparentModal', animation: 'fade' }} />
        <Stack.Screen name="ToastSuccess" component={ToastSuccessScreen} options={{ presentation: 'transparentModal', animation: 'fade' }} />
        <Stack.Screen name="ToastError" component={ToastErrorScreen} options={{ presentation: 'transparentModal', animation: 'fade' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default EpisioNavigator;
